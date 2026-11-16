#!/bin/bash
# cornerman-eval rig proof (US$0): inside a clean container, cornerman's own headless runner
# (run.mjs) drives claude -p against stub-api.mjs. Passes only if the whole chain shows:
#   P1 cornerman installed and enabled in this fresh HOME
#   P2 the threshold ask reached the model as a USER message (cornerman >= 8d96c43, #215)
#   P3 save.mjs wrote a handover
#   P4 a second segment started in a new session and its context held that handover
# Needs /harness/stub-api.mjs (mounted read-only). Writes /out/proof.json.
set -u
OUT=/out; LOG=$OUT/stub.jsonl; : > "$LOG"
fail=0; res=()
check() { if [ "$2" = 1 ]; then res+=("{\"check\":\"$1\",\"ok\":true}"); echo "ok   $1"; else res+=("{\"check\":\"$1\",\"ok\":false}"); echo "FAIL $1"; fail=1; fi; }

PLUG=$(dirname "$(dirname "$(find "$HOME/.claude/plugins" -path '*/scripts/run.mjs' | head -1)")")
grep -q "cornerman" /out/cornerman.txt 2>/dev/null && [ -n "$PLUG" ] && check P1-installed 1 || check P1-installed 0
SAVE="$PLUG/scripts/save.mjs"

cd /work && git init -q . 2>/dev/null && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
node /harness/stub-api.mjs --log "$LOG" --ctx 300000 --tool "echo step" --save "$SAVE" > $OUT/stub.url 2>$OUT/stub.err &
STUB_PID=$!
for i in $(seq 50); do [ -s $OUT/stub.url ] && break; sleep 0.1; done
URL=$(grep -o 'http://[^ ]*' $OUT/stub.url | head -1)
echo "Do the task." > $OUT/prompt.txt

ANTHROPIC_BASE_URL="$URL" ANTHROPIC_API_KEY=sk-ant-stub-not-a-key \
timeout 300 node "$PLUG/scripts/run.mjs" --max-segments 2 --total-budget-usd 1000 --nudge-at 100000 \
  --prompt-file $OUT/prompt.txt --event-log $OUT/run-events.jsonl --label proof \
  -- claude -p --max-turns 20 --max-budget-usd 100 --permission-mode bypassPermissions --output-format stream-json --verbose \
  > $OUT/run.out 2> $OUT/run.err
echo "run.mjs exit $?" >> $OUT/run.err
kill $STUB_PID 2>/dev/null

# P2: some request's last user message carries cornerman's ask head as plain user text.
node -e '
const L=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const txt=c=>typeof c==="string"?c:(c||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
const body=r=>r.body||r;
const asked=L.some(r=>(body(r).messages||[]).some(m=>m.role==="user"&&/your turn was stopped after a tool call/i.test(txt(m.content))));
process.exit(asked?0:1)' "$LOG" && check P2-ask-as-user-turn 1 || check P2-ask-as-user-turn 0

# The headless runner's store is ~/.cornerman-headless (run.mjs default).
HO=$(grep -rl "Run \`node gate.mjs next\` and carry on" "$HOME/.cornerman-headless" 2>/dev/null | head -1)
cp "$HO" $OUT/handover.md 2>/dev/null
# P5: cornerman's own ask is not carried as a user ruling (bug found by this proof on 8d96c43).
[ -n "$HO" ] && ! grep -q '\\"cornerman headless mode' "$HO" && check P5-ask-not-a-ruling 1 || check P5-ask-not-a-ruling 0
[ -n "$HO" ] && check P3-handover-saved 1 || check P3-handover-saved 0

# P4: a later request (new session) whose context contains the saved handover text.
node -e '
const L=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const s=JSON.stringify;
const i=L.findIndex(r=>/your turn was stopped after a tool call/i.test(s(r)));
const later=L.slice(i+1).some(r=>{const b=r.body||r;const ms=b.messages||[];return ms.length<=3&&/Run `node gate.mjs next` and carry on/.test(s(ms));});
process.exit(i>=0&&later?0:1)' "$LOG" && check P4-second-segment-loads-handover 1 || check P4-second-segment-loads-handover 0

printf '{"pass":%s,"checks":[%s]}\n' "$([ $fail = 0 ] && echo true || echo false)" "$(IFS=,; echo "${res[*]}")" > $OUT/proof.json
exit $fail
