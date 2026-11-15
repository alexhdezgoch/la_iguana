#!/usr/bin/env bash
# Levanta (o reinicia) el banco de pruebas: API local en :54321 y la app en :5173 con .env.rig.
# Uso: bash rig/arrancar.sh [api|app|todo]   (por defecto: todo). Bitácoras en rig/.run/
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p rig/.run
que="${1:-todo}"

reiniciar() { # nombre, comando...
  local nombre="$1"; shift
  if [ -f "rig/.run/$nombre.pid" ]; then kill "$(cat "rig/.run/$nombre.pid")" 2>/dev/null || true; sleep 0.5; fi
  nohup "$@" > "rig/.run/$nombre.log" 2>&1 &
  echo $! > "rig/.run/$nombre.pid"
  echo "$nombre: pid $!"
}

if [ "$que" = "api" ] || [ "$que" = "todo" ]; then reiniciar api node rig/servidor.mjs; fi
if [ "$que" = "app" ] || [ "$que" = "todo" ]; then reiniciar app node node_modules/vite/bin/vite.js --mode rig; fi
sleep 2
