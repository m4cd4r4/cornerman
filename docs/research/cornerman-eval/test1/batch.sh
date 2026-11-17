#!/bin/bash
# Test 1 batch (PREDICTIONS.md, frozen): 3 arms x seeds 1-8, K=3, Sonnet, cornerman pinned, at most
# 3 trial containers at once. Resume-safe: run-trial.sh skips a trial whose result.json exists.
#   batch.sh [start-at-epoch]   (waits until then; scheduled for 14:00 UTC = 22:00 AWST, off-hours)
# Run detached on the VPS: nohup bash batch.sh <epoch> > /opt/cornerman-eval/out/test1/batch.log 2>&1 &
set -u
SHA=107ff1fb11583a115b79e7063f95c7b9f1d3c005
HERE=$(dirname "$0")
OUT=/opt/cornerman-eval/out/test1
[ -n "${1:-}" ] && while [ "$(date +%s)" -lt "$1" ]; do sleep 60; done
echo "$(date -u +%FT%TZ) batch start"
running() { docker ps -q --filter name=t1- | wc -l; }
for seed in 1 2 3 4 5 6 7 8; do
  for arm in cm compact full; do
    name="t1-$arm-sonnet-s$seed-c3"
    [ -e "$OUT/$name/result.json" ] && { echo "skip $name"; continue; }
    while [ "$(running)" -ge 3 ]; do sleep 60; done
    bash "$HERE/run-trial.sh" "$arm" "$seed" 3 sonnet "$SHA" 70000 && echo "$(date -u +%FT%TZ) started $name"
    sleep 20
  done
done
while [ "$(running)" -gt 0 ]; do sleep 60; done
echo "$(date -u +%FT%TZ) batch done: $(ls "$OUT"/t1-*-sonnet-s[1-8]-c3/result.json 2>/dev/null | wc -l) of 24 result.json"
