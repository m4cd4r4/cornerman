#!/usr/bin/env node
// stub-api.mjs: a local stand-in for the Messages API, for dry checks with no model call (US$0).
//   node stub-api.mjs --log <file.jsonl> [--ctx <tokens>] [--tool "<bash command>"]
// Prints its URL. Point Claude Code at it with ANTHROPIC_BASE_URL and a dummy ANTHROPIC_API_KEY
// (never a real token). Every request body is logged. Each reply reports `ctx` input tokens, so
// the context-size hooks (cornerman nudge) see whatever size the check needs. With --tool, the
// first reply of every turn calls Bash with that command (so PostToolUse runs), the next one ends
// the turn; without it, every reply is the text "ok".
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const LOG = arg("--log"), CTX = Number(arg("--ctx", "1000")), TOOL = arg("--tool", null);
let n = 0;
// The agent the 2026-11-15 forks met (TASK-DESIGN.md, "Why it never cleared"), for the #214 dry
// check: --ignore-asks <k> leaves the first k headless asks unanswered, --never-end keeps calling
// the tool instead of ending the turn (until it has saved, or the context passes --ceiling, where
// it ends the turn as an auto-compaction would end that stretch), and --grow <tokens> adds that
// much context per request, so cornerman's 40k re-ask step can be reached.
const IGNORE = Number(arg("--ignore-asks", "0")), NEVER_END = process.argv.includes("--never-end");
const GROW = Number(arg("--grow", "0")), CEILING = Number(arg("--ceiling", "Infinity"));
let ctxNow = CTX;

function sse(res, events) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  for (const [type, data] of events) res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  res.end();
}

// --save <save.mjs>: when cornerman's headless ask is in the last message and this conversation has
// not saved yet, the next call saves a handover through the plugin's own save.mjs, as an obedient
// agent would; the turn then ends. Its body is a placeholder: the check is what save.mjs adds.
const SAVE = arg("--save", null);
const HANDOVER = "## Next action\nRun `node gate.mjs next` and carry on.\n\n## Read first\nNone\n\n## Decided, not yet applied\nNone\n\n## Open questions\nNone\n";

function reply(body) {
  // A turn's last message is a tool_result from us: end the turn. Otherwise call the tool once.
  // Claude Code 2.1.316 sends `system` role messages after a tool result (hook context, reminders),
  // so "the last message" is everything after the last assistant message.
  const msgs = body.messages || [];
  const tail = msgs.slice(msgs.findLastIndex((m) => m.role === "assistant") + 1);
  const last = { content: tail.map((m) => m.content) };
  const answered = tail.some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === "tool_result"));
  const all = JSON.stringify(body.messages);
  const savedAlready = /stub-saved-handover/.test(all);
  // Context grows only within one conversation: a fresh session (no assistant turn yet) starts over.
  if (!msgs.some((m) => m.role === "assistant")) ctxNow = CTX; else if (!savedAlready) ctxNow += GROW;
  const usage = { input_tokens: ctxNow, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  // Ids unique across stub processes, as real message ids are: fork.mjs's spend estimate tells a
  // fork's messages from the base's by id.
  const id = `msg_stub_${process.pid}_${++n}`;
  const start = ["message_start", { message: { id, type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage } }];
  // Each ask stays in the history once made, so the count of ask heads is the count of asks so far.
  const asksSoFar = (all.match(/cornerman headless mode \(/g) || []).length;
  const asked = SAVE && /cornerman headless mode/.test(JSON.stringify(last?.content ?? "")) && !savedAlready && asksSoFar > IGNORE;
  const command = asked ? `node "${SAVE.replace(/\\/g, "/")}" --title "stub-saved-handover" <<'EOF'\n${HANDOVER}EOF` : TOOL;
  const keepGoing = NEVER_END && !savedAlready && ctxNow < CEILING;
  if (command && (!answered || asked || keepGoing)) {
    const input = JSON.stringify({ command, description: "stub tool call" });
    return [start,
      ["content_block_start", { index: 0, content_block: { type: "tool_use", id: `toolu_stub_${n}`, name: "Bash", input: {} } }],
      ["content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: input } }],
      ["content_block_stop", { index: 0 }],
      ["message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 5 } }],
      ["message_stop", {}]];
  }
  return [start,
    ["content_block_start", { index: 0, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { index: 0, delta: { type: "text_delta", text: "ok" } }],
    ["content_block_stop", { index: 0 }],
    ["message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } }],
    ["message_stop", {}]];
}

createServer((req, res) => {
  let raw = "";
  req.on("data", (b) => (raw += b));
  req.on("end", () => {
    let body = {};
    try { body = JSON.parse(raw || "{}"); } catch {}
    if (LOG) appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), method: req.method, url: req.url, body }) + "\n");
    if (req.method === "POST" && /\/v1\/messages\/count_tokens/.test(req.url)) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ input_tokens: CTX }));
    }
    if (req.method === "POST" && /\/v1\/messages/.test(req.url)) {
      if (body.stream) return sse(res, reply(body));
      const ev = reply(body), msg = ev[0][1].message;
      msg.content = ev.filter(([t]) => t === "content_block_start").map(([, d]) => d.content_block);
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ...msg, stop_reason: "end_turn" }));
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end("{}");
  });
}).listen(0, "127.0.0.1", function () { console.log(`http://127.0.0.1:${this.address().port}`); });
