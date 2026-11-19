// Stop-hook logic for opt-in auto mode: once the session's context passes a
// threshold, ask Claude (once) to write a handover and tell the user to /clear.
// Hooks get no token count, so the size is read from the transcript: the last
// main-thread assistant call's input + cache tokens is the context it carried.
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { slugify, storeRoot } from "./store.mjs";
import { fileURLToPath } from "node:url";
import { autoEnabled, headless, relayOn } from "./auto-flag.mjs";
import { handoverTemplate } from "./template.mjs";

export const DEFAULT_THRESHOLD = 250_000;
// A screenshot read is a single JSONL line of base64 megabytes, so a fixed tail
// can land wholly inside one line and parse nothing - returning null, which
// looks exactly like "no assistant calls" and skips the nudge in silence. Start
// small for the usual case and grow only when nothing parsed.
const TAIL_STEPS = [256 * 1024, 1024 * 1024, 4 * 1024 * 1024, 16 * 1024 * 1024];

function readTail(transcriptPath, bytes) {
  const fd = openSync(transcriptPath, "r");
  try {
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    return { text: buf.toString("utf8"), whole: start === 0 };
  } finally {
    closeSync(fd);
  }
}

function scan(text) {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    let row;
    try {
      row = JSON.parse(lines[i]);
    } catch {
      continue; // blank line, or a line cut in half by the tail read
    }
    if (row.type !== "assistant" || row.isSidechain) continue;
    const u = row.message?.usage;
    if (!u || row.message?.model === "<synthetic>") continue;
    return (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  }
  return null;
}

// Context size of the last main-thread assistant call, or null if none found.
// Reads the file's tail, growing it: transcripts reach hundreds of MB.
export function lastContextTokens(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  for (const bytes of TAIL_STEPS) {
    const { text, whole } = readTail(transcriptPath, bytes);
    const found = scan(text);
    if (found != null) return found;
    if (whole) return null; // read the entire file and there is genuinely none
  }
  return null;
}

export { autoEnabled };

// The plugin option nudge_at, which Claude Code passes to hooks only once the
// user has set it (and bounds to 50000-1000000 itself).
export const NUDGE_AT_OPTION = "CLAUDE_PLUGIN_OPTION_NUDGE_AT";

// The VS Code footer's nudge picker writes relay/<key>.nudge.json ({ limit, at })
// for a window, <key> being the relay file whose chain holds this session. It
// wins over the environment, so a change applies to the running session and to
// the sessions the relay continues it into. Missing or unusable: null.
export function windowNudgeAt(env, sessionId) {
  if (!sessionId) return null;
  try {
    const dir = join(storeRoot(env), "relay");
    // A reload writes a new relay file for the same session, with no choice of its
    // own, so the newest choice on any file holding this session wins.
    let best = null;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json") || /\.(set|handover|nudge)\.json$/.test(name)) continue;
      try {
        const file = JSON.parse(readFileSync(join(dir, name), "utf8"));
        if (!Array.isArray(file?.sessions) || !file.sessions.includes(sessionId) || typeof file.key !== "string") continue;
        const j = JSON.parse(readFileSync(join(dir, `${file.key}.nudge.json`), "utf8"));
        const n = Number(j?.limit);
        if (!(Number.isFinite(n) && n >= 50_000 && n <= 1_000_000)) continue;
        const at = Number(j?.at) || 0;
        if (!best || at > best.at) best = { n, at };
      } catch {
        // A file with no choice, or half written: look at the next.
      }
    }
    return best ? best.n : null;
  } catch {
    // No relay folder: use the environment.
  }
  return null;
}

// How many clears the relay (hooks/relay.ts) has left for the window holding this session, read
// from its state file relay/<key>.json: Infinity for unlimited, null when no file says. A newer
// budget waiting in <key>.set.json is taken before the next clear, so it counts. Seed 4 of
// cornerman-eval Test 1 (2026-11-17) is why the nudge asks: with 3 of 3 used, a mid-turn ask to
// save and end the turn left the user's task undone, since no clear came.
export function relayClearsLeft(env, sessionId) {
  if (!sessionId) return null;
  try {
    const dir = join(storeRoot(env), "relay");
    let best = null;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json") || /\.(set|handover|nudge)\.json$/.test(name)) continue;
      try {
        const f = JSON.parse(readFileSync(join(dir, name), "utf8"));
        if (!Array.isArray(f?.sessions) || !f.sessions.includes(sessionId)) continue;
        if (!best || (Number(f.updatedAt) || 0) > (Number(best.updatedAt) || 0)) best = f;
      } catch {
        // half written or not a relay file: look at the next
      }
    }
    if (!best) return null;
    try {
      const set = JSON.parse(readFileSync(join(dir, `${best.key}.set.json`), "utf8"));
      if (Number(set?.at) > (Number(best.applied) || 0)) return clearsOf(set.limit, 0);
    } catch {
      // no newer budget waiting
    }
    return clearsOf(best.limit, Number(best.used) || 0);
  } catch {
    return null;
  }
}
const clearsOf = (limit, used) => {
  const s = String(limit ?? "").trim().toLowerCase();
  if (s === "unlimited") return Infinity;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? Math.max(0, n - used) : 0;
};

// Whether a save now makes the relay clear and continue: it is on and has a clear left. Unknown
// (no state file yet, an older mod) counts as on, as before.
const relayClears = (env, sessionId) => relayOn(env) && relayClearsLeft(env, sessionId) !== 0;

// The window override wins, then CORNERMAN_NUDGE_AT when it is a usable
// number, then the plugin option, then the default. A bad value falls through
// rather than turning the nudge off.
export function threshold(env, sessionId) {
  for (const raw of [windowNudgeAt(env, sessionId), env.CORNERMAN_NUDGE_AT, env[NUDGE_AT_OPTION]]) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_THRESHOLD;
}

const k = (n) => `${Math.round(n / 1000)}k`;

// The .nudged mark holds { asks, tokens }: how many times Claude was asked in
// this session and the context size at the last ask. A mark written by an older
// build is a bare timestamp and counts as one ask.
function readMark(env, sessionId) {
  const mark = join(storeRoot(env), ".nudged", sessionId);
  if (!existsSync(mark)) return null;
  const raw = readFileSync(mark, "utf8");
  try {
    const m = JSON.parse(raw);
    if (Number.isFinite(m?.asks)) return { asks: m.asks, tokens: Number(m.tokens) || 0 };
  } catch {
    // A bare timestamp from an older build is not JSON.
  }
  return { asks: 1, tokens: 0 };
}

function writeMark(env, sessionId, mark) {
  const marks = join(storeRoot(env), ".nudged");
  mkdirSync(marks, { recursive: true });
  writeFileSync(join(marks, sessionId), JSON.stringify({ ...mark, at: new Date().toISOString() }), "utf8");
}

// True the first time this session claims the nudge. Both nudges share the mark,
// so the first ask is made once per session, whichever trigger gets there.
function claimNudge(env, sessionId, tokens) {
  if (readMark(env, sessionId)) return false;
  writeMark(env, sessionId, { asks: 1, tokens });
  return true;
}

// Every ask carries this line, so the next Stop can find the last one in the
// transcript and see what Claude did after it.
const ASK_MARK = "cornerman auto mode";
const HEADLESS_MARK = "cornerman headless mode";
export const MAX_ASKS = 3;
// After Claude answers without saving, ask again only once the context has grown by this much.
const ANSWERED_GROWTH = 40_000;
const FINISHED_REPLY = "Nothing to hand over.";
const DEFER_REPLY = "Handover not yet:";

// What Claude did since the last ask, read from the transcript tail: "saved" (a
// handover skill or save.mjs call), "finished" or "deferred" (it replied with one
// of the two answers the ask offers), or null (neither, as if it never saw it).
export function answerSince(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  for (const bytes of TAIL_STEPS) {
    const { text, whole } = readTail(transcriptPath, bytes);
    const lines = text.split("\n");
    let at = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes(ASK_MARK) || lines[i].includes(HEADLESS_MARK)) {
        at = i;
        break;
      }
    }
    if (at < 0) {
      if (whole) return null;
      continue;
    }
    let answer = null;
    for (const line of lines.slice(at + 1)) {
      if (!line.includes('"type":"assistant"')) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      if (row.isSidechain) continue;
      for (const b of row.message?.content ?? []) {
        if (b.type === "tool_use") {
          const cmd = `${b.input?.skill ?? ""} ${b.input?.command ?? ""}`;
          if ((b.name === "Skill" && /handover/.test(cmd)) || (b.name === "Bash" && /save\.mjs/.test(cmd))) return "saved";
        } else if (b.type === "text") {
          if (b.text.includes(FINISHED_REPLY)) answer = "finished";
          else if (b.text.includes(DEFER_REPLY)) answer = answer ?? "deferred";
        }
      }
    }
    return answer;
  }
  return null;
}

export function runStop(input, { env = process.env } = {}) {
  if (!autoEnabled(env)) return null;
  if (input.stop_hook_active) return null; // Claude is already continuing from a Stop hook
  const sessionId = slugify(input.session_id ?? "");
  if (!sessionId) return null;

  const tokens = lastContextTokens(input.transcript_path);
  const limit = threshold(env, sessionId);
  if (tokens == null || tokens < limit) return null;

  // The relay is on and has used its clears (fault 7 of cornerman-eval stage A, 2026-11-18): asked
  // here, the agent saved a handover nothing loads and wrote "type /clear" to a user who may not be
  // there, and nothing cleared. Only the user can clear now, so only the user is told, once; Claude
  // keeps the turn for their work. Claimed like an ask, so a budget raised later gets a real one.
  if (!headless(env) && relayOn(env) && relayClearsLeft(env, sessionId) === 0) {
    if (!claimNudge(env, sessionId, tokens)) return null;
    return {
      systemMessage:
        `cornerman: context is about ${k(tokens)} tokens (nudge at ${k(limit)}), and the relay has no clears left in this window, so Claude is not asked to hand over. ` +
        `To carry on in a fresh context, ask for /cornerman:handover, then type /clear.`,
    };
  }

  if (!claimNudge(env, sessionId, tokens)) {
    // Asked before. Under the headless runner the process ending is the answer.
    if (headless(env)) return null;
    return remind(env, sessionId, input.transcript_path, tokens, limit);
  }

  if (headless(env)) {
    return {
      systemMessage: `cornerman: context is about ${k(tokens)} tokens (nudge at ${k(limit)}). Claude is asked to commit and save a handover; the runner resumes it.`,
      hookSpecificOutput: { hookEventName: "Stop", additionalContext: headlessAsk(tokens, limit, false) },
    };
  }

  // Not `decision: "block"`: Claude Code 2.1.283 shows a block as "Stop hook
  // error: ...", which reads as a crash. Stop's additionalContext still keeps
  // the turn going so Claude can act, with the same stop_hook_active loop guard,
  // but is labelled "Stop hook feedback". systemMessage is the user's own line.
  const clears = relayClears(env, sessionId);
  return {
    systemMessage: userLine(clears, tokens, limit, "Claude is asked to save a handover"),
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext:
        `${askHead(tokens, limit)}: ` +
        (clears
          ? `Save by default: write a handover now with the /cornerman:handover skill, then ${afterSave(clears)}. ${CHOICES}`
          : `At a clean stopping point, write a handover now with the /cornerman:handover skill, then ${afterSave(clears)}. ` +
            `If you are mid-task, finish the current step first, or reply "${DEFER_REPLY} <reason>".`),
    },
  };
}

// The ask was made and Claude neither saved nor answered it: ask again at this
// turn end, up to MAX_ASKS in all. An answer ("Nothing to hand over." or "Handover
// not yet: ...") holds the next ask back until the context has grown by
// ANSWERED_GROWTH; a saved handover ends the asks (the relay clears on it).
function remind(env, sessionId, transcriptPath, tokens, limit) {
  const mark = readMark(env, sessionId);
  if (!mark || mark.asks >= MAX_ASKS) return null;
  const answer = answerSince(transcriptPath);
  if (answer === "saved") return null;
  if (answer !== null && tokens < mark.tokens + ANSWERED_GROWTH) return null;
  const asks = mark.asks + 1;
  writeMark(env, sessionId, { asks, tokens });
  const clears = relayClears(env, sessionId);
  return {
    systemMessage: userLine(clears, tokens, limit, `Claude is asked again to save a handover (ask ${asks} of ${MAX_ASKS})`),
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext:
        `${askHead(tokens, limit, `reminder ${asks} of ${MAX_ASKS}`)}: ` +
        `Write a handover now with the /cornerman:handover skill, then ${afterSave(clears)}. ${CHOICES}`,
    },
  };
}

// Under the headless runner (run.mjs) there is no user to /clear: the process
// ending is the clear and the runner starts the next segment from the handover.
// A finished task must NOT save one, or the runner resumes a done job: the Stop
// hook fires on the final turn end too.
const SAVE_SCRIPT = fileURLToPath(new URL("../save.mjs", import.meta.url));
// The sections come from the handover skill's own template (lib/template.mjs), so a
// headless handover keeps the decisions and do-nots an interactive one keeps.
function headlessAsk(tokens, limit, midTurn, reminder) {
  // Only the section headings, in one line: the whole 50-line template arrived inside a
  // Read result looking like file content, and Haiku ignored it as an injection in 2 of 3
  // sandbox runs (the old short ask: 1 of 1 obeyed, 2026-11-15). The asks stay two sentences.
  const heads = [...handoverTemplate().matchAll(/^## (.+)$/gm)].map((m) => `"## ${m[1]}"`);
  return (
    `${HEADLESS_MARK} (${reminder ? `reminder ${reminder} of ${MAX_ASKS}, ` : ""}context about ${k(tokens)} tokens, threshold ${k(limit)}${midTurn ? ", your turn was stopped after a tool call" : ""}): ` +
    `If your task is finished, do not save a handover, just end. ` +
    `Otherwise ${reminder ? "stop now and do not start the next step, checkpoint or item even if it is part of the same task, then " : midTurn ? "finish the current step without starting new work, then " : ""}commit all your work on your branch, then save a handover by running ` +
    `node "${SAVE_SCRIPT.replace(/\\/g, "/")}" --title "<short title>" with the handover markdown on stdin (a quoted heredoc), ` +
    (heads.length ? `with the sections ${heads.join(", ")} (an empty one left out, but "Read first", "Decided, not yet applied" and "Open questions" say None), ` : "") +
    `putting every ruling, decision and do-not the user gave in chat in their own words and copying any open STOP question verbatim, ` +
    `then end your turn with no further tool calls.`
  );
}

// What every ask to Claude opens with. ASK_MARK is how the next Stop finds the last ask.
function askHead(tokens, limit, extra) {
  return `${ASK_MARK} (${extra ? `${extra}, ` : ""}context about ${k(tokens)} tokens, threshold ${k(limit)})`;
}

// The line the user sees. Plain and calm on purpose: it is a status note, not a fault.
function userLine(clears, tokens, limit, ask) {
  const then = clears ? "and the relay then clears and continues by itself" : "then you can type /clear";
  return `cornerman: context is about ${k(tokens)} tokens (nudge at ${k(limit)}). ${ask}, ${then}.`;
}

// The two answers that hold the next ask back. With the relay on, a saved handover
// is what makes it clear and continue, so a finished task must end without one or
// the relay resumes a done job (same rule as headlessAsk). Finishing the latest
// request is not a finished session, so saving stays the default.
const CHOICES =
  `Reply "${FINISHED_REPLY}" instead only if the user's whole goal for this session is done, not just the latest request, and nothing is left open; ` +
  `reply "${DEFER_REPLY} <reason>" if the work cannot stop yet.`;

// What Claude does once the handover is saved. With the relay on (hooks/relay.ts)
// the mod runs /clear when the turn ends, so Claude must end the turn rather than
// hand the user a /clear to type. The why is left out: Claude needs the step.
function afterSave(clears) {
  return clears ? `end your turn with no further tool calls` : `tell the user to type /clear`;
}

// Under the headless runner there is no user, and a turn can run for hours: the
// q1m retest (2026-11-15) agent got one mid-turn ask at 556k, read "the current
// step" as the whole checkpoint run, and never ended its turn, so Stop never asked
// again. So mid-turn asks again, more firmly, each time the context has grown
// ANSWERED_GROWTH past the last ask, up to MAX_ASKS, until save.mjs has run.
function remindHeadless(env, sessionId, transcriptPath, tokens, limit) {
  const mark = readMark(env, sessionId);
  if (!mark || mark.asks >= MAX_ASKS) return null;
  if (tokens < mark.tokens + ANSWERED_GROWTH) return null;
  if (answerSince(transcriptPath) === "saved") return null;
  const asks = mark.asks + 1;
  writeMark(env, sessionId, { asks, tokens });
  return pauseForAsk(env, sessionId, tokens, limit, headlessAsk(tokens, limit, true, asks),
    `cornerman: context is about ${k(tokens)} tokens (nudge at ${k(limit)}). The turn is stopped and the runner asks again for a commit and a handover (ask ${asks} of ${MAX_ASKS}).`);
}

// Under the headless runner a mid-turn ask is not hook context. Sonnet dropped it without a word
// in 7 of 9 trials at 556k, whatever the wording (q1m ask-wording A/B, 2026-11-16): the task in
// front of it won. So the hook ends the turn at this tool boundary (`continue: false`) and leaves
// the ask in the store; run.mjs resumes the same session with it as the next user message.
// The stopReason is shown to the model ("hook stopped continuation: ..."), so it only says a
// message follows.
const PENDING = ".ask";
const pendingPath = (env, sessionId) => join(storeRoot(env), PENDING, `${slugify(sessionId)}.json`);

function pauseForAsk(env, sessionId, tokens, limit, ask, systemMessage) {
  mkdirSync(join(storeRoot(env), PENDING), { recursive: true });
  writeFileSync(pendingPath(env, sessionId), JSON.stringify({ ask, tokens, limit, at: new Date().toISOString() }), "utf8");
  return { continue: false, stopReason: "cornerman: context threshold reached; the next message says what to do.", systemMessage };
}

// The ask a paused session is waiting for, removed as it is read so it is sent once. Null if none.
export function takePendingAsk(env, sessionId) {
  const file = pendingPath(env, sessionId);
  try {
    const { ask } = JSON.parse(readFileSync(file, "utf8"));
    rmSync(file, { force: true });
    return typeof ask === "string" && ask.trim() ? ask : null;
  } catch {
    rmSync(file, { force: true });
    return null;
  }
}

// PostToolUse: the Stop hook only runs when a turn ends, so a single long
// tool-heavy turn can cross the threshold and be compacted without it ever
// getting a chance. This one warns mid-turn instead. Interactively it never
// blocks - a tool result is the wrong place to interrupt work - and it never asks
// for the turn to be abandoned, only for a handover at the next clean point.
// Under the headless runner it stops the turn instead (pauseForAsk).
export function runMidTurn(input, { env = process.env } = {}) {
  if (!autoEnabled(env)) return null;
  const sessionId = slugify(input.session_id ?? "");
  if (!sessionId) return null;

  const tokens = lastContextTokens(input.transcript_path);
  const limit = threshold(env, sessionId);
  if (tokens == null || tokens < limit) return null;
  // The relay is on but has no clear left: a save would not clear, so a mid-turn ask only takes
  // the turn from the user's request (seeds 4 and 5: saved, "Run /clear", task undone). Nothing is
  // claimed, so the Stop hook asks once the request is answered, telling the user to /clear.
  if (!headless(env) && relayOn(env) && relayClearsLeft(env, sessionId) === 0) return null;
  if (!claimNudge(env, sessionId, tokens)) return headless(env) ? remindHeadless(env, sessionId, input.transcript_path, tokens, limit) : null;

  if (headless(env)) {
    return pauseForAsk(env, sessionId, tokens, limit, headlessAsk(tokens, limit, true),
      `cornerman: context is about ${k(tokens)} tokens (nudge at ${k(limit)}). The turn is stopped and the runner asks for a commit and a handover.`);
  }

  const clears = relayClears(env, sessionId);
  return {
    systemMessage: userLine(clears, tokens, limit, "Claude is asked to save a handover when this step is done"),
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext:
        `${askHead(tokens, limit, "turn still running")}: ` +
        (clears
          ? `Save by default: finish the current step without abandoning it, then write a handover with the /cornerman:handover skill and ${afterSave(clears)}. ${CHOICES}`
          : `Finish the current step without abandoning it, then write a handover with the /cornerman:handover skill and ${afterSave(clears)}, ` +
            `or reply "${DEFER_REPLY} <reason>" if the work cannot stop yet.`),
    },
  };
}
