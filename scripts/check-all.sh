#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm --prefix server run typecheck
npm --prefix server run lint
npm --prefix server test
npm --prefix server run build
npm --prefix web run check

node --test scripts/executor-registry.test.mjs
