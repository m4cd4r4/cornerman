// Every session in the last 14 days that began with /clear: what did cornerman do at its start?
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2];
const since = Date.now() - 14 * 86400e3;
const out = { loaded: 0, noneLoaded: 0, silent: 0 };
const silentRows = [], noneRows = [];
for (const d of readdirSync(root)) {
  const dir = join(root, d);
  let files; try { files = readdirSync(dir).filter((n) => n.endsWith(".jsonl")); } catch { continue; }
  for (const n of files) {
    const p = join(dir, n);
    if (statSync(p).mtimeMs < since) continue;
    const lines = readFileSync(p, "utf8").split("\n").slice(0, 60);
    const head = lines.join("\n");
    if (!head.includes("<command-name>/clear</command-name>")) continue;
    // only the start: text before the first assistant message
    const firstAsst = lines.findIndex((l) => l.includes('"type":"assistant"'));
    const start = (firstAsst < 0 ? lines : lines.slice(0, firstAsst)).join("\n");
    const ts = (start.match(/"timestamp":"([^"]+)"/) || [])[1] || "";
    if (Date.parse(ts) < since) continue;
    if (/(cornerman|clear-resume): loaded handover/.test(start)) out.loaded++;
    else if (start.includes("none loaded")) { out.noneLoaded++; noneRows.push(`${ts.slice(0, 16)} ${d}`); }
    else { out.silent++; silentRows.push(`${ts.slice(0, 16)} ${d}`); }
  }
}
console.log(out);
console.log("--- none loaded:\n" + noneRows.sort().join("\n"));
console.log("--- silent (first 40):\n" + silentRows.sort().slice(-40).join("\n"));
