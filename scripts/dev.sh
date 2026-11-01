#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
if [ ! -f server/.env ]; then echo 'Run npm run setup first'; exit 1; fi
npm --prefix server run dev > logs/server.log 2>&1 &
server_pid=$!
ready=0
for _ in $(seq 1 90); do
  if curl -sf -m 2 http://127.0.0.1:9010/api/v1/health >/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo 'API process exited. See logs/server.log' >&2
    exit 1
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo 'API did not become ready. See logs/server.log' >&2
  exit 1
fi
npm --prefix web run dev > logs/web.log 2>&1 &
web_pid=$!
trap 'kill "$server_pid" "$web_pid" 2>/dev/null || true; wait || true' EXIT INT TERM
printf 'Web: http://127.0.0.1:5173\nAPI: http://127.0.0.1:9010/api/v1/health\nLogs: logs/server.log and logs/web.log\n'
wait
