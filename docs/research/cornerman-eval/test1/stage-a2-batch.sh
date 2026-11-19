#!/bin/bash
# Stage A2 (PREDICTIONS-STAGE-A2.md): cm arm rerun on seeds 1-8 with cornerman at the sha after PR 218.
# Same image, driver and arguments as run-trial.sh; separate output folder so the Test 1 cm trials
# are kept. At most 3 containers at once. Resume-safe: a trial whose result.json exists is skipped.
# Same stall guard as batch.sh. The env file path comes from CM_ENV_FILE, never from this file.
#   CM_ENV_FILE=<path> setsid nohup bash stage-a2-batch.sh > <out>/batch.log 2>&1 < /dev/null &
set -u
SHA=fea0ceeeef316c6574f27755de75833261f86138
OUT=${T1_OUT:-/opt/cornerman-eval/out/test1-stage-a2}
ENVF=${CM_ENV_FILE:?set CM_ENV_FILE to the trial env file}
mkdir -p "$OUT"
stalled() {
  local d start end na
  for d in "$OUT"/t1-cm-sonnet-s[1-8]-c3; do
    [ -e "$d/result.json" ] && [ -e "$d/driver.log" ] || continue
    start=$(date -d "$(head -1 "$d/driver.log" | cut -d' ' -f1)" +%s 2>/dev/null) || continue
    end=$(stat -c %Y "$d/result.json")
    na=$(grep -c '"acted": "not-attempted"' "$d/result.json")
    if [ $((end - start)) -lt 600 ]; then echo "$(basename "$d") finished in $((end - start)) s"; return 0; fi
    if [ "$na" -ge 12 ]; then echo "$(basename "$d") has $na probes not-attempted"; return 0; fi
  done
  return 1
}
echo "$(date -u +%FT%TZ) stage A2 batch start, cornerman $SHA"
running() { docker ps -q --filter name=t1b- | wc -l; }
for seed in 1 2 3 4 5 6 7 8; do
  name="t1-cm-sonnet-s$seed-c3"
  [ -e "$OUT/$name/result.json" ] && { echo "skip $name"; continue; }
  while [ "$(running)" -ge 3 ]; do sleep 60; done
  if why=$(stalled); then echo "$(date -u +%FT%TZ) STALL GUARD: $why; no more launches"; break; fi
  mkdir -p "$OUT/$name" && chown 1000:1000 "$OUT/$name"
  docker rm -f "t1b-cm-s$seed" >/dev/null 2>&1 || true
  docker run -d --name "t1b-cm-s$seed" --memory 1536m --cpus 1 \
    --env-file "$ENVF" -e CM_REF="$SHA" -e CM_INSTALL=1 \
    -v /opt/cornerman-eval/test1:/test1:ro -v "$OUT/$name":/out \
    cornerman-eval:dev node /test1/driver.mjs --arm cm --seed "$seed" --clears 3 --model sonnet --nudge-at 70000 >/dev/null \
    && echo "$(date -u +%FT%TZ) started $name"
  sleep 20
done
while [ "$(running)" -gt 0 ]; do sleep 60; done
echo "$(date -u +%FT%TZ) stage A2 batch done: $(ls "$OUT"/t1-cm-sonnet-s[1-8]-c3/result.json 2>/dev/null | wc -l) of 8 result.json"
