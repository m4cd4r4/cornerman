#!/bin/bash
# Floor variant check (STRESS-TEST-DESIGN.md, step 2): short floor trials with a forced variant
# index, so runs 0-5 put every variant of every pool through an agent that was told and then lost
# everything to one /clear. A variant the floor passes is dropped from the design.
#   CM_ENV_FILE=<path> bash floor-check.sh [k ...]      (default: 0 1 2 3 4 5)
# At most 3 containers at once. Resume-safe: a run whose result.json exists is skipped.
# The env file path comes from CM_ENV_FILE, never from this file.
set -u
BASE=${CM_EVAL_DIR:-/opt/cornerman-eval}
OUT=${ST_OUT:-$BASE/out/stress-floor-check}
ENVF=${CM_ENV_FILE:?set CM_ENV_FILE to the trial env file}
[ -e "$BASE/reading/index.txt" ] || { echo "no reading corpus in $BASE/reading: run stress/reading/build.mjs first"; exit 1; }
mkdir -p "$OUT"
running() { docker ps -q --filter name=stfc- | wc -l; }
for k in "${@:-0 1 2 3 4 5}"; do for k in $k; do
  name="floor-short-k$k"
  [ -e "$OUT/$name/result.json" ] && { echo "skip $name"; continue; }
  while [ "$(running)" -ge 3 ]; do sleep 60; done
  mkdir -p "$OUT/$name" && chown 1000:1000 "$OUT/$name"
  docker rm -f "stfc-k$k" >/dev/null 2>&1 || true
  docker run -d --name "stfc-k$k" --memory 1536m --cpus 1 \
    --env-file "$ENVF" -e CM_INSTALL=0 \
    -v "$BASE/test1":/test1:ro -v "$BASE/rig":/rig:ro -v "$BASE/stress":/stress:ro -v "$BASE/reading":/reading:ro -v "$OUT/$name":/out \
    cornerman-eval:dev node /stress/driver.mjs --arm floor --seed $((900 + k)) --force "$k" --short --model sonnet >/dev/null \
    && echo "$(date -u +%FT%TZ) started $name"
  sleep 20
done; done
