#!/usr/bin/env bash
# Reconstruye la base local de pruebas desde cero: stub de Supabase, migraciones, semilla y cuentas de prueba.
# Solo toca la base local "iguana" en 127.0.0.1. Falla al primer error. Uso: bash rig/reset.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PGPASSWORD="${RIG_PGPASSWORD:-rig}"
PSQL=(psql -h 127.0.0.1 -U rig -d iguana -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f rig/limpiar.sql
"${PSQL[@]}" -f rig/stub_supabase.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
node rig/semilla.mjs
"${PSQL[@]}" -f supabase/seed.sql
"${PSQL[@]}" -f rig/usuarios.sql
echo "Base local lista."
