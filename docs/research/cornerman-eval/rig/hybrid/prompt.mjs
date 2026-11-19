// Hybrid arm, UserPromptSubmit: log the user's words (cornerman's rulings log, same code as the cm
// arm) and keep an uncut copy. Never blocks a prompt. Prints only when a compaction has just left
// dropped items pending and no tool call has handed them over yet (deliver.mjs).
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { STORE, cm, deliver, fullLog, input, trace } from "./lib.mjs";

const inp = input();
try {
  const { record, userWords } = await cm("rulings.mjs");
  record(STORE, inp.session_id, inp.prompt);
  const text = userWords(inp.prompt);
  if (text) {
    const file = fullLog(inp.session_id);
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), text }) + "\n");
  }
  deliver("UserPromptSubmit", inp.session_id);
} catch (e) {
  trace("error", { hook: "prompt", error: String(e?.stack ?? e) });
}
