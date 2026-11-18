// node persisted.mjs <out>...: per cm trial, how big was cornerman's SessionStart context in each
// session, was it cut to a preview by the CLI ("Output too large"), and did the agent then open the
// full copy (the persisted file, ~/.cornerman/loaded or ~/.cornerman/artifacts)?
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
for (const OUT of process.argv.slice(2)) {
  console.log(`== ${OUT.split("/").at(-1)}`);
  for (let s = 1; s <= 8; s++) {
    const d = join(OUT, `t1-cm-sonnet-s${s}-c3`);
    const sess = readdirSync(join(d, "transcripts")).map((f) => readFileSync(join(d, "transcripts", f), "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean))
      .map((lines) => ({ lines, first: lines.find((o) => o.timestamp)?.timestamp ?? "" })).sort((a, b) => a.first.localeCompare(b.first));
    const row = sess.map(({ lines }) => {
      const all = lines.map((o) => JSON.stringify(o));
      const big = all.map((t) => /Output too large \(([0-9.]+)KB\)[^"]{0,200}additionalContext/.exec(t)?.[1]).filter(Boolean);
      const ctx = lines.filter((o) => o.attachment?.type === "hook_additional_context" && /cornerman: this session continues/.test(JSON.stringify(o.attachment.content))).map((o) => JSON.stringify(o.attachment.content).length);
      const opened = lines.filter((o) => o.type === "assistant").flatMap((o) => o.message.content ?? []).filter((c) => c.type === "tool_use" && /additionalContext|cornerman\/loaded|cornerman\/artifacts|tool-results/.test(JSON.stringify(c.input))).map((c) => c.name);
      return `[ctx ${ctx.map((n) => (n / 1000).toFixed(1) + "k").join(",") || "-"}${big.length ? " CUT " + [...new Set(big)].join(",") + "KB" : ""}${opened.length ? " opened:" + opened.length : ""}]`;
    });
    console.log(`s${s} ${row.join(" ")}`);
  }
}
