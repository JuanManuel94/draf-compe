#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${TMPDIR:-/tmp}/brawl-draft-pro-${UID}"
mkdir -p "$STATE_DIR"

fail() {
  printf '\nERROR: %s\n' "$1" >&2
  read -r -p 'Pulsa Enter para cerrar…' _ || true
  exit 1
}

command -v node >/dev/null 2>&1 || fail 'No encuentro Node.js. Instálalo y vuelve a abrir este lanzador.'
command -v npm >/dev/null 2>&1 || fail 'No encuentro npm. Instala Node.js con npm y vuelve a abrir este lanzador.'
command -v curl >/dev/null 2>&1 || fail 'Falta curl, necesario para comprobar que la aplicación arrancó.'

if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
  printf 'Instalando dependencias del proyecto…\n'
  (cd "$PROJECT_DIR" && npm install) || fail 'No se pudieron instalar las dependencias.'
fi

start_service() {
  local name="$1" url="$2"
  local pidfile="$STATE_DIR/$name.pid" logfile="$STATE_DIR/$name.log"
  if curl --silent --fail --max-time 1 "$url" >/dev/null 2>&1; then
    printf '%s ya está funcionando.\n' "$name"
    return
  fi
  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    printf '%s ya está iniciándose…\n' "$name"
    return
  fi
  printf 'Iniciando %s…\n' "$name"
  (cd "$PROJECT_DIR" && nohup npm run "$name" >>"$logfile" 2>&1 </dev/null & echo $! >"$pidfile")
}

start_service server http://127.0.0.1:3001/api/health
start_service dev http://127.0.0.1:5173/

wait_for_url() {
  local name="$1" url="$2"
  for _ in $(seq 1 40); do
    if curl --silent --fail --max-time 1 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  printf '\nNo arrancó %s. Registro disponible en: %s\n' "$name" "$STATE_DIR/$name.log" >&2
  tail -n 30 "$STATE_DIR/$name.log" >&2 || true
  fail "No se pudo iniciar $name."
}

wait_for_url 'la API' http://127.0.0.1:3001/api/health
wait_for_url 'la aplicación' http://127.0.0.1:5173/
printf 'Abriendo Brawl Draft Pro en el navegador…\n'
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://127.0.0.1:5173/ >/dev/null 2>&1 || fail 'No se pudo abrir el navegador automáticamente.'
elif command -v gio >/dev/null 2>&1; then
  gio open http://127.0.0.1:5173/ >/dev/null 2>&1 || fail 'No se pudo abrir el navegador automáticamente.'
else
  printf 'Abre esta dirección en tu navegador: http://127.0.0.1:5173/\n'
fi
printf 'Listo. Puedes cerrar esta ventana; los servicios seguirán funcionando.\n'
