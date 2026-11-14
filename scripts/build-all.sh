#!/usr/bin/env bash
# Build every playable single-file page into builds/.
set -e
build() { VITE_VARIANT=$1 SINGLE=1 npx vite build >/dev/null 2>&1; node scripts/artifact.cjs "$2" "builds/$3.html"; }
build main "Synth" synth
build garden "Synth Garden" variant-garden
build tame "Synth Tame Hearts" variant-tame-hearts
build avatar "Synth With a Body" variant-avatar
