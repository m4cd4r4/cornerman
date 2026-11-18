// SessionStart hook for the compaction spike: log the input; after a compaction, add one fact that
// exists nowhere else, so a later question shows whether hook context reaches the model.
import { appendFileSync, readFileSync } from "node:fs";
let input = "";
try { input = readFileSync(0, "utf8"); } catch {}
appendFileSync("/out/hooks/sessionstart.jsonl", JSON.stringify({ at: new Date().toISOString(), input }) + "\n");
let source = "";
try { source = JSON.parse(input).source ?? ""; } catch {}
if (source === "compact") {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "Project note carried by a hook: the staging port is 4417." } }));
}
