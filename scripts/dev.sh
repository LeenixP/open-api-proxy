#!/bin/bash
set -e
echo "Starting open-api-proxy in development mode..."
npx vite --config vite.config.ts &
VITE_PID=$!
npx tsc --watch --preserveWatchOutput &
TSC_PID=$!
npx tsx --watch src/index.ts &
SRV_PID=$!
trap "kill $VITE_PID $TSC_PID $SRV_PID 2>/dev/null; exit 0" INT TERM
wait
