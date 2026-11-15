#!/bin/sh
# One joint-search round on every core. Usage: sh search/round-joint.sh [first-seed] [candidates]
# Results land in parts/rounds/ (tracked). Same seed, same result, on any machine.
set -e
cd "$(dirname "$0")/.."
FIRST="${1:-1}"; CANDS="${2:-300}"
CORES=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)
mkdir -p rounds
echo "joint round: $CORES jobs, seeds $FIRST.., $CANDS candidates each"
i=0; while [ "$i" -lt "$CORES" ]; do s=$((FIRST + i)); node search/joint.mjs "$s" "$CANDS" "rounds/joint-$s.json" 5000 > "rounds/joint-$s.log" 2>&1 & i=$((i + 1)); done
wait
tail -n 2 rounds/joint-*.log
