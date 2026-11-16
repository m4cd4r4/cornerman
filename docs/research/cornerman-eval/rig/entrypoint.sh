#!/bin/sh
# cornerman-eval entrypoint: install cornerman into this container's fresh HOME, then run the trial.
#   CM_SOURCE   marketplace source (default: the public GitHub repo, the README's install line)
#   CM_REF      optional git ref (tag or sha) to pin; the repo is cloned and added as a local path
#   CM_INSTALL  0 = no cornerman (control arms)
set -eu

# Claude Code onboarding and the /work trust prompt, so the TUI (interactive arm) starts clean.
[ -f "$HOME/.claude.json" ] || printf '%s\n' \
  '{"hasCompletedOnboarding":true,"theme":"dark","projects":{"/work":{"hasTrustDialogAccepted":true,"hasCompletedProjectOnboarding":true}}}' \
  > "$HOME/.claude.json"

CM_SOURCE="${CM_SOURCE:-https://github.com/m4cd4r4/cornerman}"
if [ "${CM_INSTALL:-1}" = 1 ]; then
  src="$CM_SOURCE"
  if [ -n "${CM_REF:-}" ]; then
    git clone -q "$CM_SOURCE" "$HOME/cornerman-src"
    git -C "$HOME/cornerman-src" checkout -q "$CM_REF"
    src="$HOME/cornerman-src"
  fi
  claude plugin marketplace add "$src" > /out/install.log 2>&1
  claude plugin install cornerman@cornerman >> /out/install.log 2>&1
  {
    echo "source=$CM_SOURCE ref=${CM_REF:-default-branch}"
    [ -d "$HOME/cornerman-src" ] && echo "sha=$(git -C "$HOME/cornerman-src" rev-parse HEAD)"
    claude plugin list 2>&1
  } > /out/cornerman.txt
fi
claude --version > /out/claude-version.txt 2>&1 || true

exec "$@"
