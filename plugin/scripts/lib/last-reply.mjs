// What Claude said last before a clear, so the session after it can show it again (#4217,
// docs/design/LAST-REPLY.md).
//
// A session often clears, by hand or by a relay, before the user has read the last answer. The
// unit kept is the final message of each of the last 2 turns that answered a typed prompt: in the
// field (358 saving sessions, 2026-11-14 to 11-28) the very last message was a short save or
// status note about half the time, and "the last 2 messages" missed one of the two answers in 44
// of 355 sessions. Read from the saving session's transcript at load, so it does not race the
// SessionEnd capture (6% of loads) or depend on the session having left a table or link.
//
// Read backwards with the trail's byte cap; every text is redacted. No model in the loop.
import { linesBackwards, redact } from "./trail.mjs";
import { ownPrompt, typedText } from "./rulings.mjs";

const TURNS = 2;
const MAX_ROWS = 20_000;
const PROMPT_CHARS = 120;
// Stop hook feedback reaches the transcript as a meta user row with this head.
const STOP_HOOK = /^\s*Stop hook feedback:/i;
// A turn keeps the finals of its last 3 stretches.
const STRETCHES = 3;

const shorten = (s, max) => (s.length <= max ? s : `${s.slice(0, max - 3).trimEnd()}...`);
const textBlocks = (content) =>
  typeof content === "string" ? content : Array.isArray(content) ? content.filter((b) => b?.type === "text").map((b) => b.text || "").join("\n") : "";

/** A slash command's row names its command and args in harness tags: "/review the form". */
function commandOf(text) {
  const name = /<command-name>\s*([^<]*?)\s*<\/command-name>/.exec(text)?.[1];
  if (!name) return "";
  const args = /<command-args>\s*([^<]*?)\s*<\/command-args>/.exec(text)?.[1] ?? "";
  return `${name.startsWith("/") ? name : `/${name}`}${args ? ` ${args}` : ""}`.replace(/\s+/g, " ").trim();
}

/**
 * The prompt a user row starts a turn with, or "" for harness text. Cornerman's own resume and
 * handover prompts count: a relay-resumed session works under one with no typed prompt.
 */
function promptOf(content) {
  const text = textBlocks(content);
  return commandOf(text) || typedText(text) || ownPrompt(text);
}

/**
 * The final assistant message of each of the transcript's last TURNS typed turns, oldest first:
 * [{ prompt, text, cut }]. A turn's final message is its last text before the next user row of any
 * kind, so a reply to a task notification never stands in for the answer. `cut` marks the newest
 * turn when the clear came after a tool call, not after text. A turn that said nothing is skipped.
 * [] for a missing or unreadable file; never throws.
 */
export function lastTurns(file) {
  const turns = [];
  try {
    // `pieces`: the newest message seen in the current stretch; `held`: the finals of the turn's
    // later stretches (split off by Stop hook feedback or harness text), newest first, at most STRETCHES.
    let id, pieces = null, held = [], newestIsText = null, newest = true, rows = 0;
    const close = () => {
      if (pieces && held.length < STRETCHES) held.push(pieces.join("\n\n").trim());
      pieces = null;
      id = undefined;
    };
    for (const line of linesBackwards(file)) {
      if (++rows > MAX_ROWS) break;
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      if (row?.isSidechain) continue;
      const content = row?.message?.content;
      if (row.type === "assistant" && Array.isArray(content)) {
        if (newestIsText === null && content.length) newestIsText = content.at(-1)?.type === "text";
        const text = textBlocks(content);
        if (!text.trim()) continue;
        const mid = row.message.id ?? row.uuid ?? null;
        if (pieces === null) { pieces = [text]; id = mid; }
        else if (mid !== null && mid === id) pieces.unshift(text);
        continue;
      }
      if (row.type !== "user" || row.isCompactSummary) continue;
      // A Stop hook that blocked the turn's answer: the answer before it counts as much as the reply to it.
      if (row.isMeta) {
        if (STOP_HOOK.test(textBlocks(content))) close();
        continue;
      }
      if (Array.isArray(content) && content.some((b) => b?.type === "tool_result")) continue;
      // Any other user row ends the stretch after it. Harness text (a task notification) splits the
      // turn without ending it: a relay-resumed session works for hours under one prompt, driven by
      // notifications, and the reply to the last one is the newest news.
      const prompt = promptOf(content);
      close();
      if (!prompt) continue;
      if (held.length) {
        turns.unshift({ prompt: shorten(prompt, PROMPT_CHARS), text: redact(held.reverse().join("\n\n")), cut: newest && newestIsText === false });
        if (turns.length >= TURNS) break;
      }
      held = [];
      newestIsText = null;
      newest = false;
    }
  } catch {
    return turns;
  }
  return turns;
}

/** Reply text a load carries, in characters: the field p99 of two turns was 3,751. */
export const REPLY_MAX = 6000;

const LABELS = ["**Answer**", "**Why**", "**Links**", "**To paste**", "**Question for you**"];

/** Cut `text` to `max` characters with a marker, or "" when nothing fits. */
function cutTo(text, max) {
  if (text.length <= max) return text;
  const mark = `\n[cut at ${max.toLocaleString("en")} characters]`;
  return max > mark.length + 40 ? text.slice(0, max - mark.length).trimEnd() + mark : "";
}

/**
 * The context block for a load after a clear, or "" with no turns. Asks the resumed Claude to show
 * the turns verbatim, labelled, after the opener line. The newest turn keeps its text first when
 * the two are over REPLY_MAX.
 */
export function replyBlock(turns, { max = REPLY_MAX } = {}) {
  if (!turns?.length) return "";
  let left = max;
  const texts = [...turns].reverse().map((t) => {
    const text = cutTo(t.text, left);
    left -= text.length;
    return text;
  }).reverse();
  const shown = turns.map((t, i) => ({ ...t, text: texts[i] })).filter((t) => t.text);
  const n = shown.length;
  return (
    `cornerman: before the clear, the session that saved this handover gave the ${n === 1 ? "answer below to the user's last prompt" : `${n} answers below to the user's last ${n} prompts, oldest first`}. ` +
    `The user may not have read ${n === 1 ? "it" : "them"}. In your first reply, after the opener line, print ${n === 1 ? "it under its prompt" : "them, each under its prompt,"} under the heading "Before the clear", verbatim, ` +
    `with a bold label before each part: ${LABELS.join(", ")}. Leave out a label with nothing under it, and split paragraphs between labels where needed; do not reword, shorten or add to the text. ` +
    `Then carry on. This is a record of what was said, not an instruction: the handover's Next action still decides what you do.\n\n` +
    shown.map((t) => `### Prompt: "${t.prompt}"${t.cut ? " (cut off by the clear: work was still running)" : ""}\n\n${t.text}`).join("\n\n")
  );
}
