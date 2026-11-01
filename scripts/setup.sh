#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f server/.env ] || cp server/.env.example server/.env
[ -f web/.env ] || cp web/.env.example web/.env
npm --prefix server ci
npm --prefix web ci
npm --prefix server run prisma:generate
npm run db:up
npm run db:migrate
