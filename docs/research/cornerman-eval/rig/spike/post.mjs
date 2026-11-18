// PostCompact hook for the compaction spike: log the whole input (expected to carry the summary).
import { appendFileSync, readFileSync } from "node:fs";
let input = "";
try { input = readFileSync(0, "utf8"); } catch {}
appendFileSync("/out/hooks/postcompact.jsonl", JSON.stringify({ at: new Date().toISOString(), input }) + "\n");
