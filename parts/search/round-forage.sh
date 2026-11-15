#!/bin/sh
# One forage-search round on every core. Usage: sh search/round-forage.sh [first-seed] [evals]
# Results land in parts/rounds/ (tracked). Same seed, same result, on any machine.
set -e
cd "$(dirname "$0")/.."
FIRST="${1:-11}"; EVALS="${2:-150000}"
CORES=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)
mkdir -p rounds
echo "forage round: $CORES jobs, seeds $FIRST.., $EVALS builds each"
i=0; while [ "$i" -lt "$CORES" ]; do s=$((FIRST + i)); node search/forage.mjs "$s" "$EVALS" "rounds/forage-$s.json" > "rounds/forage-$s.log" 2>&1 & i=$((i + 1)); done
wait
tail -n 1 rounds/forage-*.log
