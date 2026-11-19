// Hybrid arm, PostToolUse: after a compaction, hand the model the durable items the latest summary
// dropped (left by post.mjs), once. Runs on every tool call; with nothing pending it prints nothing.
// Why not SessionStart: see the order of events in lib.mjs.
import { deliver, input, trace } from "./lib.mjs";

const inp = input();
try { deliver("PostToolUse", inp.session_id); } catch (e) { trace("error", { hook: "deliver", error: String(e?.stack ?? e) }); }
