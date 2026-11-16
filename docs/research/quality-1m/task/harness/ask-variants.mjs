// ask-variants.mjs: the ask-wording A/B (TASK-DESIGN.md, "Ask-wording A/B"). Each variant is a
// headlessAsk function that replaces the one in cornerman 36b12c9's plugin/scripts/lib/nudge.mjs.
// Only the wording changes; the channel (PostToolUse additionalContext), the threshold and the
// re-ask logic stay 36b12c9's.
//   v072   0.7.2's headlessAsk, verbatim from the v0.7.2 clone. Its save path is SAVE_SCRIPT, so it
//          names the save.mjs of the plugin that actually runs.
//   c214   36b12c9 unchanged (the control).
//   short  finish the step, commit, save via save.mjs, end the turn. No section list, no
//          "every ruling ... the user gave in chat" clause, no "naming the single next action".
//
// Why the source clone is patched and not the installed cache copy: a plugin installed from a local
// marketplace folder runs its hooks from that folder. In fork-clear214-sonnet-r1 the ask's save
// path was I:/Scratch/_q1m-cornerman-36b12c9/plugin/scripts/save.mjs, which is SAVE_SCRIPT, which
// nudge.mjs builds from its own import.meta.url. So each variant gets its own clone, patched before
// the plugin is installed from it (the cache copy then matches too).
import { readFileSync } from "node:fs";

export const VARIANTS = ["v072", "c214", "short"];
const V072_NUDGE = "I:/Scratch/_q1m-cornerman-v0.7.2/plugin/scripts/lib/nudge.mjs";

// The function text from "function headlessAsk(" to its closing brace at column 0.
export function askFunction(src) {
  const a = src.indexOf("function headlessAsk(");
  if (a === -1) throw new Error("no headlessAsk in nudge.mjs");
  const b = src.indexOf("\n}\n", a);
  if (b === -1) throw new Error("headlessAsk has no closing brace at column 0");
  return src.slice(a, b + 2);
}

const SHORT = `function headlessAsk(tokens, limit, midTurn, reminder) {
  // q1m ask-wording A/B, variant "short".
  return (
    \`\${HEADLESS_MARK} (\${reminder ? \`reminder \${reminder} of \${MAX_ASKS}, \` : ""}context about \${k(tokens)} tokens, threshold \${k(limit)}\${midTurn ? ", turn still running" : ""}): \` +
    \`If your task is finished, do not save a handover, just end. \` +
    \`Otherwise \${midTurn ? "finish the current step without starting new work, then " : ""}commit your work, then save a handover by running \` +
    \`node "\${SAVE_SCRIPT.replace(/\\\\/g, "/")}" --title "<short title>" with the handover markdown on stdin (a quoted heredoc), \` +
    \`then end your turn with no further tool calls.\`
  );
}`;

export function variantFunction(variant, original) {
  if (variant === "c214") return askFunction(original);
  if (variant === "v072") return askFunction(readFileSync(V072_NUDGE, "utf8"));
  if (variant === "short") return SHORT;
  throw new Error(`unknown ask variant ${variant}`);
}

export function patchNudge(original, variant) {
  const old = askFunction(original);
  const fresh = variantFunction(variant, original);
  return original.replace(old, () => fresh); // a function: "$" in the new text is not a pattern
}
