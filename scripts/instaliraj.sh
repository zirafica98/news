#!/bin/bash
# Podešava jutarnju automatiku na ovom Mac-u. Može da se pokrene više puta.
#   1. pravi kopiju repoa na internom disku (~/.ai-jutro/repo), jer se spoljni disk zna otkačiti
#   2. instalira pakete za skripte (~2 MB, bez Angular-a)
#   3. registruje launchd posao: 06:30, uz rezervu u 09:00 i 12:00
#
# Pokretanje: bash scripts/instaliraj.sh
# Uklanjanje: bash scripts/instaliraj.sh --ukloni

set -euo pipefail

LABEL="com.aijutro.jutro"
HOME_DIR="$HOME/.ai-jutro"
CLONE_DIR="$HOME_DIR/repo"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REMOTE="$(git -C "$(dirname "${BASH_SOURCE[0]}")" remote get-url origin)"
DOMAIN="gui/$(id -u)"

if [[ "${1:-}" == "--ukloni" ]]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Automatika je isključena. Kopija repoa je ostala u $CLONE_DIR (obriši je ručno ako želiš)."
  exit 0
fi

mkdir -p "$HOME_DIR"

if [[ -d "$CLONE_DIR/.git" ]]; then
  echo "• Kopija repoa već postoji, osvežavam…"
  git -C "$CLONE_DIR" pull --ff-only --quiet
else
  echo "• Pravim kopiju repoa u $CLONE_DIR…"
  git clone --quiet "$REMOTE" "$CLONE_DIR"
fi

echo "• Instaliram pakete za skripte…"
npm ci --prefix "$CLONE_DIR/scripts" --no-audit --no-fund --loglevel=error
touch "$CLONE_DIR/scripts/node_modules"

echo "• Registrujem jutarnji posao (06:30, rezerva 09:00 i 12:00)…"
mkdir -p "$(dirname "$PLIST")"
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$CLONE_DIR/scripts/jutro.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key>
  <string>$HOME_DIR/launchd.log</string>
  <key>StandardErrorPath</key>
  <string>$HOME_DIR/launchd.log</string>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
EOF

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"

echo
echo "Gotovo. Jutarnji posao je registrovan:"
launchctl print "$DOMAIN/$LABEL" | grep -E "^\s+(state|path) =" || true
echo
echo "Logovi:     $CLONE_DIR/scripts/logs/"
echo "Test odmah: bash $CLONE_DIR/scripts/jutro.sh --provera"
echo
echo "Da bi se Mac sam probudio u 06:25 (mora biti na punjaču), jednom pokreni:"
echo "  sudo pmset repeat wake MTWRFSU 06:25:00"
