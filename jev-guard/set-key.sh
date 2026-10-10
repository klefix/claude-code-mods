#!/bin/sh
set -eu
umask 077
mkdir -p "$HOME/.config/jev-guard"
printf 'Vercel AI Gateway API key: '
stty -echo
read -r key
stty echo
printf '\n'
printf '%s\n' "$key" > "$HOME/.config/jev-guard/key"
chmod 600 "$HOME/.config/jev-guard/key"
echo "Saved to ~/.config/jev-guard/key"
