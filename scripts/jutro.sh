#!/bin/bash
# AI News — jutarnja skripta. Radi redom:
#   git pull → skupljanje vesti → Claude piše izdanje → provera → git push → notifikacija
#
# Pokreće je launchd u 06:30 (i u 09:00 i 12:00 kao rezervu ako je Mac bio ugašen ili nešto puklo).
# Ako je današnje izdanje već objavljeno, odmah završava.
#
# Ručno:  bash scripts/jutro.sh             (pravo pokretanje)
#         bash scripts/jutro.sh --provera   (proveri internet, git, pakete i Claude prijavu, bez objavljivanja)

set -euo pipefail

export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export GIT_TERMINAL_PROMPT=0

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$REPO_DIR/scripts/logs"
DATUM="$(TZ=Europe/Belgrade date +%F)"
LOG_FILE="$LOG_DIR/$DATUM.log"
LOCK_DIR="${TMPDIR:-/tmp}/ai-jutro.lock"
PROVERA=false
[[ "${1:-}" == "--provera" ]] && PROVERA=true

mkdir -p "$LOG_DIR"
exec >>"$LOG_FILE" 2>&1

log() { echo "[$(date +%H:%M:%S)] $*"; }

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

# Samo jedno pokretanje u isto vreme.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  if [[ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +60 2>/dev/null)" ]]; then
    rm -rf "$LOCK_DIR" && mkdir "$LOCK_DIR"
  else
    exit 0
  fi
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

# Ne daj Mac-u da zaspi dok skripta radi.
caffeinate -i -w $$ &

echo
log "===== AI News $DATUM $($PROVERA && echo '(provera)') ====="
cd "$REPO_DIR"

# 1. Internet (posle buđenja Wi-Fi-ju treba koji trenutak).
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null https://github.com && break
  [[ $i -eq 60 ]] && { log "Nema interneta ni posle 10 minuta."; false; }
  sleep 10
done
log "Internet radi."

# 2. Najnovija verzija repoa.
git pull --ff-only --quiet
log "git pull: $(git log -1 --format='%h %s')"

if [[ -f "public/data/$DATUM.json" ]] && ! $PROVERA; then
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
if ! claude auth status 2>/dev/null | grep -q '"loggedIn": true'; then
  log "Claude Code nije prijavljen. Pokreni 'claude' u Terminalu i prijavi se."
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

# 5. Skupljanje vesti.
node scripts/fetch-news.mjs --datum="$DATUM"

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
git commit --quiet -m "Izdanje $DATUM"
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
