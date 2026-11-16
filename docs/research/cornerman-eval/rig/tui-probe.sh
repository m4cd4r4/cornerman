#!/bin/bash
# tui-probe: does cornerman's relay save, clear and carry on in the plain terminal app?
# Real `claude` TUI in tmux, one typed prompt, screen captured every 2 s, transcripts listed after.
# A clear shows as a second transcript whose first user message is cornerman's resume prompt.
#   stub (default, US$0): stub API reporting a large context; shows hooks and relay load.
#   REAL=1: the real model on CLAUDE_CODE_OAUTH_TOKEN, CORNERMAN_NUDGE_AT (default 35000), PROMPT.
set -u
OUT=/out
PLUG=$(dirname "$(dirname "$(find "$HOME/.claude/plugins" -path '*/scripts/run.mjs' | head -1)")")
# Tools allowed by rule, as a user would allow them, instead of the bypass mode (its warning
# prompt is not skipped by config). The plugin install already wrote enabledPlugins here.
S="$HOME/.claude/settings.json"; [ -f "$S" ] || echo '{}' > "$S"
jq '.permissions.allow = ["Bash","Read","Edit","Write","Glob","Grep","Skill"]' "$S" > /tmp/s && mv /tmp/s "$S"
cd /work && git init -q . && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init

if [ "${REAL:-0}" = 1 ]; then
  ENVLINE="export CORNERMAN_NUDGE_AT=${CORNERMAN_NUDGE_AT:-35000}"
  PROMPT="${PROMPT:-Do the task.}"
else
  KEY=sk-ant-stub-not-a-key; LOG=$OUT/stub.jsonl; : > "$LOG"
  # Pre-approve the stub key (Claude Code asks once per custom key, by its last 20 characters).
  jq --arg k "${KEY: -20}" '.customApiKeyResponses = {approved: [$k], rejected: []}' "$HOME/.claude.json" > /tmp/cj && mv /tmp/cj "$HOME/.claude.json"
  node /harness/stub-api.mjs --log "$LOG" --ctx 300000 --tool "echo step" --save "$PLUG/scripts/save.mjs" > $OUT/stub.url 2>$OUT/stub.err &
  for i in $(seq 50); do [ -s $OUT/stub.url ] && break; sleep 0.1; done
  URL=$(grep -o 'http://[^ ]*' $OUT/stub.url | head -1)
  ENVLINE="export ANTHROPIC_BASE_URL=$URL ANTHROPIC_API_KEY=$KEY"
  PROMPT="Do the task."
fi
cat > /tmp/run-claude.sh <<EOF
$ENVLINE
claude ${TUI_ARGS:-}
echo "CLAUDE-EXITED \$?"
sleep 600
EOF
printf '%s' "$PROMPT" > /tmp/prompt.txt
tmux new-session -d -s t -x 200 -y 50 "bash /tmp/run-claude.sh"
sleep 8; tmux capture-pane -p -t t > $OUT/screen-0.txt
tmux load-buffer /tmp/prompt.txt; tmux paste-buffer -t t; sleep 0.5; tmux send-keys -t t Enter
STEPS=${WAIT_STEPS:-45}
for i in $(seq 1 $STEPS); do
  sleep 2; tmux capture-pane -p -t t > $OUT/screen-last.txt
  [ $((i % 15)) = 0 ] && cp $OUT/screen-last.txt $OUT/screen-$i.txt
  # Stop early once the relay has cleared and the fresh session has gone idle again.
  n=$(ls $HOME/.claude/projects/*/*.jsonl 2>/dev/null | wc -l)
  [ "${REAL:-0}" = 1 ] && [ "$n" -ge "${STOP_AT_SESSIONS:-99}" ] && grep -q "^❯ *$" $OUT/screen-last.txt && break
done
for f in $(ls -tr $HOME/.claude/projects/*/*.jsonl 2>/dev/null); do echo "== $f"; jq -rc 'select(.type=="user" and (.isMeta|not)) | (.message.content|if type=="string" then . else (map(.text? // .type)|join(" ")) end)[0:200]' "$f" 2>/dev/null | grep -v '^tool_result$' | head -6; done > $OUT/user-msgs.txt
cp $HOME/.claude/projects/*/*.jsonl $OUT/ 2>/dev/null
find $HOME/.cornerman -maxdepth 2 2>/dev/null > $OUT/store.txt
mkdir -p $OUT/cm && cp -r $HOME/.cornerman/. $OUT/cm/ 2>/dev/null
tmux kill-server 2>/dev/null
