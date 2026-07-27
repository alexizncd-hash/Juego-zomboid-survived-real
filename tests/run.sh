#!/usr/bin/env bash
# Lanza toda la suite de ZONA CERO.
#
#   ./tests/run.sh            → todo
#   ./tests/run.sh puertas    → solo las pruebas cuyo nombre contenga "puertas"
#
# Cada prueba abre un navegador sin ventana, JUEGA de verdad y escupe un JSON
# con lo que midió. Las expectativas viven en tests/expected.json, así que las
# pruebas solo miden y las reglas se leen en un único sitio.
#
# Requisitos: node con playwright y un Chromium. Se pueden apuntar con
#   NODE_PATH=/ruta/a/node_modules  CHROMIUM=/ruta/a/chromium
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8123}"
MOCK_PORT="${MOCK_PORT:-8199}"
FILTRO="${1:-}"
mkdir -p tests/_out

python3 -m http.server "$PORT" >/dev/null 2>&1 &
SRV=$!
python3 tests/mock_supabase.py >/dev/null 2>&1 &
MOCK=$!
cleanup(){ kill "$SRV" "$MOCK" 2>/dev/null || true; }
trap cleanup EXIT
sleep 1
echo "▶ servidor :$PORT · imitador de Supabase :$MOCK_PORT"
echo

fallos=0; total=0
for t in tests/*.test.js; do
  nombre=$(basename "$t" .test.js)
  if [ -n "$FILTRO" ]; then case "$nombre" in *"$FILTRO"*) ;; *) continue ;; esac; fi
  total=$((total+1))
  printf '  %-20s ' "$nombre"
  salida=$(node "$t" 2>&1)
  veredicto=$(printf '%s' "$salida" | node tests/verify.js "$nombre" 2>&1)
  if [ "${veredicto%%|*}" = "OK" ]; then
    echo "✅ ${veredicto#*|}"
  else
    echo "❌"
    printf '%s\n' "${veredicto#*|}" | sed 's/^/       /'
    fallos=$((fallos+1))
  fi
done

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ $total/$total en verde"
else
  echo "❌ $fallos de $total fallaron"
fi
exit "$fallos"
