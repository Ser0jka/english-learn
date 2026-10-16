#!/bin/bash
set -euo pipefail
cd -- "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf 'Для запуска установите Node.js 24: https://nodejs.org\n'
  read -r -p 'Нажмите Enter, чтобы закрыть окно.'
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi
if [ ! -f dist/index.html ]; then
  npm run build
fi
printf '\nLexi: http://localhost:%s\nОставьте это окно открытым, пока пользуетесь приложением.\n\n' "${PORT:-5173}"
exec npm start
