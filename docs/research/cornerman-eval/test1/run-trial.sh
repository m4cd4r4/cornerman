#!/bin/bash
# Run one Test 1 trial in a fresh, capped container on the VPS.
#   run-trial.sh <arm cm|full|compact> <seed> <clears> [model] [cornerman-ref] [nudge-at]
# Results land in /opt/cornerman-eval/out/test1/<arm>-<model>-s<seed>-c<clears>/ (result.json,
# driver.log, transcripts, the cornerman store). Detached: prints the container name.
set -eu
ARM=$1 SEED=$2 CLEARS=$3 MODEL=${4:-sonnet} REF=${5:-main} NUDGE=${6:-70000}
NAME="t1-$ARM-$MODEL-s$SEED-c$CLEARS"
OUT=/opt/cornerman-eval/out/test1/$NAME
[ -e "$OUT/result.json" ] && { echo "exists: $OUT"; exit 0; }
mkdir -p "$OUT" && chown 1000:1000 "$OUT"
INSTALL=1; [ "$ARM" = cm ] || INSTALL=0
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --memory 1536m --cpus 1 \
  --env-file /opt/cornerman-eval/.env -e CM_REF="$REF" -e CM_INSTALL=$INSTALL \
  -v /opt/cornerman-eval/test1:/test1:ro -v "$OUT":/out \
  cornerman-eval:dev node /test1/driver.mjs --arm "$ARM" --seed "$SEED" --clears "$CLEARS" --model "$MODEL" --nudge-at "$NUDGE" >/dev/null
echo "$NAME"
