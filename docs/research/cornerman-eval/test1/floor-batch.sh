#!/bin/bash
# Floor arm (exploratory, after the frozen Test 1 batch; Macdara card 2026-11-17 09:50 AWST):
# no cornerman, plain /clear after work turns 3, 6, 9, seeds 1-8, at most 3 containers at once.
# Resume-safe (run-trial.sh skips a trial whose result.json exists). Same stall guard as batch.sh.
#   setsid nohup bash floor-batch.sh > /opt/cornerman-eval/out/test1/floor-batch.log 2>&1 < /dev/null &
set -u
HERE=$(dirname "$0")
OUT=${T1_OUT:-/opt/cornerman-eval/out/test1}
stalled() {
  local d start end na
  for d in "$OUT"/t1-floor-sonnet-s[1-8]-c3; do
    [ -e "$d/result.json" ] && [ -e "$d/driver.log" ] || continue
    start=$(date -d "$(head -1 "$d/driver.log" | cut -d' ' -f1)" +%s 2>/dev/null) || continue
    end=$(stat -c %Y "$d/result.json")
    na=$(grep -c '"acted": "not-attempted"' "$d/result.json")
    if [ $((end - start)) -lt 600 ]; then echo "$(basename "$d") finished in $((end - start)) s"; return 0; fi
    if [ "$na" -ge 12 ]; then echo "$(basename "$d") has $na probes not-attempted"; return 0; fi
  done
  return 1
}
echo "$(date -u +%FT%TZ) floor batch start"
running() { docker ps -q --filter name=t1- | wc -l; }
for seed in 1 2 3 4 5 6 7 8; do
  name="t1-floor-sonnet-s$seed-c3"
  [ -e "$OUT/$name/result.json" ] && { echo "skip $name"; continue; }
  while [ "$(running)" -ge 3 ]; do sleep 60; done
  if why=$(stalled); then echo "$(date -u +%FT%TZ) STALL GUARD: $why; no more launches"; break; fi
  bash "$HERE/run-trial.sh" floor "$seed" 3 sonnet main 70000 && echo "$(date -u +%FT%TZ) started $name"
  sleep 20
done
while [ "$(running)" -gt 0 ]; do sleep 60; done
echo "$(date -u +%FT%TZ) floor batch done: $(ls "$OUT"/t1-floor-sonnet-s[1-8]-c3/result.json 2>/dev/null | wc -l) of 8 result.json"
