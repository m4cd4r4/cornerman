// PreCompact hook for the compaction spike: log the input, block once on request, add an instruction.
import { appendFileSync, existsSync, readFileSync, rmSync } from "node:fs";
let input = "";
try { input = readFileSync(0, "utf8"); } catch {}
appendFileSync("/out/hooks/precompact.jsonl", JSON.stringify({ at: new Date().toISOString(), input }) + "\n");
if (existsSync("/tmp/block-next")) {
  rmSync("/tmp/block-next");
  console.error("spike: compaction blocked by the PreCompact hook");
  process.exit(2);
}
console.log("The summary must contain this exact line on its own: MARKER-ZEBRA-7731");
