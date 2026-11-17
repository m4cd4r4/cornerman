#!/bin/bash
# Test 1 batch (PREDICTIONS.md, frozen): 3 arms x seeds 1-8, K=3, Sonnet, cornerman pinned, at most
# 3 trial containers at once. Resume-safe: run-trial.sh skips a trial whose result.json exists.
#   batch.sh [start-at-epoch]   (waits until then; scheduled for 14:00 UTC = 22:00 AWST, off-hours)
# Run detached on the VPS: nohup bash batch.sh <epoch> > /opt/cornerman-eval/out/test1/batch.log 2>&1 &
# Stall guard (audit 2026-11-17): a usage limit ends every turn in seconds with no driver TIMEOUT, so
# each later trial would finish as junk and spend the night. Before each launch, a finished trial that
# took under 10 minutes (a real one takes about 33) or has 12+ probes not-attempted stops new launches.
# To resume after a stall: delete the named trial's dir (it is INVALID), then run batch.sh again.
set -u
SHA=107ff1fb11583a115b79e7063f95c7b9f1d3c005
HERE=$(dirname "$0")
OUT=${T1_OUT:-/opt/cornerman-eval/out/test1}
stalled() {
  local d start end na
  for d in "$OUT"/t1-*-sonnet-s[1-8]-c3; do
    [ -e "$d/result.json" ] && [ -e "$d/driver.log" ] || continue
    start=$(date -d "$(head -1 "$d/driver.log" | cut -d' ' -f1)" +%s 2>/dev/null) || continue
    end=$(stat -c %Y "$d/result.json")
    na=$(grep -c '"acted": "not-attempted"' "$d/result.json")
    if [ $((end - start)) -lt 600 ]; then echo "$(basename "$d") finished in $((end - start)) s"; return 0; fi
    if [ "$na" -ge 12 ]; then echo "$(basename "$d") has $na probes not-attempted"; return 0; fi
  done
  return 1
}
[ "${1:-}" = "--check-stall" ] && { stalled; exit $?; }
[ -n "${1:-}" ] && while [ "$(date +%s)" -lt "$1" ]; do sleep 60; done
echo "$(date -u +%FT%TZ) batch start"
running() { docker ps -q --filter name=t1- | wc -l; }
for seed in 1 2 3 4 5 6 7 8; do
  for arm in cm compact full; do
    name="t1-$arm-sonnet-s$seed-c3"
    [ -e "$OUT/$name/result.json" ] && { echo "skip $name"; continue; }
    while [ "$(running)" -ge 3 ]; do sleep 60; done
    if why=$(stalled); then echo "$(date -u +%FT%TZ) STALL GUARD: $why; no more launches"; break 2; fi
    bash "$HERE/run-trial.sh" "$arm" "$seed" 3 sonnet "$SHA" 70000 && echo "$(date -u +%FT%TZ) started $name"
    sleep 20
  done
done
while [ "$(running)" -gt 0 ]; do sleep 60; done
echo "$(date -u +%FT%TZ) batch done: $(ls "$OUT"/t1-*-sonnet-s[1-8]-c3/result.json 2>/dev/null | wc -l) of 24 result.json"
