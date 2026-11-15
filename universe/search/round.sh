#!/bin/sh
# Run one search round on all cores and collect the results into a tracked folder.
# Usage: sh search/round.sh <round-name> <jobs-file>
# The jobs file has one command per line; each is run from the universe/ directory.
# Results are deterministic for a given seed, on any machine.
set -e
cd "$(dirname "$0")/.."
NAME="$1"; JOBS="$2"; OUT="rounds/$NAME"; mkdir -p "$OUT" results
CORES=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)
echo "round $NAME on $CORES cores, $(grep -c . "$JOBS") jobs"
# xargs keeps up to CORES jobs running at once
grep . "$JOBS" | sed "s|@OUT@|$OUT|g" | xargs -P "$CORES" -I CMD sh -c 'echo "start: CMD"; CMD > /dev/null 2>&1 || echo "FAILED: CMD"; echo "done: CMD"'
ls -la "$OUT"
