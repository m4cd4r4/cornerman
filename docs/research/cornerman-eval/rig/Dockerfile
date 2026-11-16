# cornerman-eval trial image: one fresh container per trial.
# Clean HOME every run (no volume on it), so nothing from Macdara's ~/.claude reaches a trial.
# Claude Code is pinned; cornerman is installed at container start (entrypoint.sh) the way a user
# installs it: `claude plugin marketplace add <repo>` + `claude plugin install cornerman@cornerman`.
FROM node:22-bookworm-slim

ARG CLAUDE_CODE_VERSION=2.1.316
RUN apt-get update \
 && apt-get install -y --no-install-recommends git tmux ca-certificates jq procps \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
 && npm cache clean --force

COPY entrypoint.sh /usr/local/bin/cm-entrypoint
COPY proof.sh /usr/local/bin/cm-proof
RUN chmod 755 /usr/local/bin/cm-entrypoint /usr/local/bin/cm-proof \
 && mkdir -p /work /out /harness && chown node:node /work /out

ENV DISABLE_AUTOUPDATER=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    IS_SANDBOX=1
USER node
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/cm-entrypoint"]
CMD ["bash"]
