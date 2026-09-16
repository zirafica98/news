#!/bin/bash
# AI News — jutarnja skripta. Radi redom:
#   git pull → skupljanje vesti → cene → Claude piše izdanje → provera → prevod → git push
#
# Svako jutro je pokreće GitHub Actions (.github/workflows/jutro.yml), a može i ručno na Mac-u.
# Ako je današnje izdanje već objavljeno, odmah završava.
#
# Ručno:  bash scripts/jutro.sh             (pravo pokretanje)
#         bash scripts/jutro.sh --provera   (proveri internet, git, pakete i Claude prijavu, bez objavljivanja)
#         bash scripts/jutro.sh --ponovo    (napravi današnje izdanje ponovo, i ako već postoji)

set -euo pipefail

# launchd na Mac-u daje skoro prazan PATH, a na GitHub-u postojeći PATH sadrži Node i Claude Code, pa se samo dopunjuje.
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH:/usr/bin:/bin:/usr/sbin:/sbin"
export GIT_TERMINAL_PROMPT=0

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$REPO_DIR/scripts/logs"
DATUM="$(TZ=Europe/Belgrade date +%F)"
LOG_FILE="$LOG_DIR/$DATUM.log"
LOCK_DIR="${TMPDIR:-/tmp}/ai-jutro.lock"
PROVERA=false
PONOVO=false
[[ "${1:-}" == "--provera" ]] && PROVERA=true
[[ "${1:-}" == "--ponovo" ]] && PONOVO=true

mkdir -p "$LOG_DIR"
# Na Mac-u sve ide u log fajl; na GitHub-u (CI) ostaje u ispisu posla, gde se i čita.
[[ -z "${CI:-}" ]] && exec >>"$LOG_FILE" 2>&1

log() { echo "[$(TZ=Europe/Belgrade date +%H:%M:%S)] $*"; }

notify() {
  local poruka="${1//\"/\\\"}"
  osascript -e "display notification \"$poruka\" with title \"AI News\" sound name \"${2:-Glass}\"" >/dev/null 2>&1 || true
}

on_error() {
  local code=$?
  log "GREŠKA (kod $code) u liniji $1. Log: $LOG_FILE"
  notify "Izdanje za danas nije napravljeno. Pogledaj log: scripts/logs/$DATUM.log" "Basso"
  exit "$code"
}
trap 'on_error $LINENO' ERR

cd "$REPO_DIR"

if [[ -z "${AI_NEWS_OSVEZENO:-}" ]]; then
  # Ne daj Mac-u da zaspi dok skripta radi. -s drži Mac budnim i kad je poklopac zatvoren (samo na punjaču):
  # posle buđenja u 06:25 macOS ga inače vrati na spavanje za par minuta, usred Claude-ovog pisanja.
  # exec ispod zadržava isti PID, pa caffeinate prati i ponovo pokrenutu skriptu.
  command -v caffeinate >/dev/null && { caffeinate -s -i -w $$ & }
  export AI_NEWS_BUDAN=1

  echo
  log "===== AI News $DATUM $($PROVERA && echo '(provera)')$($PONOVO && echo '(ponovo)') ====="

  # 1. Internet (posle buđenja Wi-Fi-ju treba koji trenutak).
  for i in $(seq 1 60); do
    curl -s --max-time 5 -o /dev/null https://github.com && break
    [[ $i -eq 60 ]] && { log "Nema interneta ni posle 10 minuta."; false; }
    sleep 10
  done
  log "Internet radi."

  # 2. Najnovija verzija repoa, pa ponovo pokreni ovu skriptu da važe i izmene u njoj samoj.
  git pull --ff-only --quiet
  log "git pull: $(git log -1 --format='%h %s')"
  export AI_NEWS_OSVEZENO=1
  exec bash "$REPO_DIR/scripts/jutro.sh" "$@"
fi

# Samo jedno pokretanje u isto vreme. Staro pokretanje koje visi duže od sat vremena se gasi.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  stari_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [[ -n "$stari_pid" ]] && kill -0 "$stari_pid" 2>/dev/null && [[ -z "$(find "$LOCK_DIR" -maxdepth 0 -mmin +60 2>/dev/null)" ]]; then
    log "Već radi drugo pokretanje (PID $stari_pid). Kraj."
    exit 0
  fi
  if [[ -n "$stari_pid" ]] && kill -0 "$stari_pid" 2>/dev/null; then
    log "Prethodno pokretanje (PID $stari_pid) visi duže od sat vremena, gasim ga."
    pkill -TERM -P "$stari_pid" 2>/dev/null || true
    kill -TERM "$stari_pid" 2>/dev/null || true
    sleep 5
  fi
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
fi
echo $$ >"$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR"' EXIT

# Ako je pre git pull-a radila starija verzija skripte bez caffeinate-a, uključi ga ovde.
[[ -z "${AI_NEWS_BUDAN:-}" ]] && command -v caffeinate >/dev/null && { caffeinate -s -i -w $$ & }

if [[ -f "public/data/$DATUM.json" ]] && ! $PROVERA && ! $PONOVO; then
  log "Izdanje za $DATUM je već objavljeno. Kraj."
  exit 0
fi

# 3. Paketi za skripte (samo prvi put ili kad se promene).
if [[ ! -d scripts/node_modules ]] || [[ scripts/package-lock.json -nt scripts/node_modules ]]; then
  log "Instaliram pakete za skripte…"
  npm ci --prefix scripts --no-audit --no-fund --loglevel=error
  touch scripts/node_modules
fi

# 4. Da li je Claude prijavljen.
# Na GitHub-u se prijavljuje tokenom iz tajne CLAUDE_CODE_OAUTH_TOKEN.
if [[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]] && ! claude auth status 2>/dev/null | grep -q '"loggedIn": true'; then
  log "Claude Code nije prijavljen. Na Mac-u pokreni 'claude' i prijavi se; na GitHub-u dodaj tajnu CLAUDE_CODE_OAUTH_TOKEN (claude setup-token)."
  false
fi

if $PROVERA; then
  odgovor="$(echo 'Odgovori samo rečju: OK' | claude -p --model sonnet --tools "" --no-session-persistence 2>&1 | tail -1)"
  log "Claude odgovara: $odgovor"
  node scripts/fetch-news.mjs --datum="$DATUM" | sed 's/^/  /'
  log "Provera je prošla. Ništa nije objavljeno."
  notify "Provera je prošla: internet, git i Claude rade."
  exit 0
fi

# 5. Skupljanje vesti. Kod ponovnog pravljenja ne preskačemo vesti koje su već ušle u današnje izdanje.
node scripts/fetch-news.mjs --datum="$DATUM" $($PONOVO && echo --ponovo)

# 5b. Cene tokena. Ako OpenRouter ne radi, izdanje ide i bez njih.
node scripts/fetch-prices.mjs --datum="$DATUM" || log "Cene tokena nisu osvežene, nastavljam bez njih."

# 6. Claude piše izdanje (jedan ponovni pokušaj ako padne).
if ! node scripts/write-digest.mjs --datum="$DATUM"; then
  log "Prvi pokušaj nije uspeo, pokušavam ponovo za minut…"
  sleep 60
  node scripts/write-digest.mjs --datum="$DATUM"
fi

# 7. Provera i objavljivanje.
node scripts/finalize.mjs --datum="$DATUM"

# 7b. Engleski prevod. Ako ne uspe, srpsko izdanje svejedno ide na sajt.
node scripts/translate-digest.mjs --datum="$DATUM" || log "Engleski prevod nije uspeo, objavljujem samo srpsko izdanje."

# 8. Slanje na GitHub → Vercel pravi novi build.
git add public/data scripts/state
git commit --quiet -m "Izdanje $DATUM$($PONOVO && echo ' (ponovo)')"
if ! git push --quiet; then
  log "Push odbijen, povlačim izmene i pokušavam ponovo…"
  git pull --rebase --quiet
  git push --quiet
fi
log "Poslato na GitHub: $(git log -1 --format='%h')"

prvi_naslov="$(node -e "console.log(require('./public/data/$DATUM.json').vesti[0].naslov)")"
notify "Izdanje je spremno ☕ $prvi_naslov"

# Stari logovi se brišu posle 30 dana.
find "$LOG_DIR" -name '*.log' -mtime +30 -delete
log "Gotovo."
