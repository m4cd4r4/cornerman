// node stage-a2-checks.mjs <out>: PREDICTIONS-STAGE-A2.md B3 to B8, read from the transcripts.
// Per cm trial and session: the sizes of cornerman's session-start outputs, whether the CLI cut one
// ("Output too large"), whether part 2 (the standing rules) arrived, what each output says it left
// out, whether the agent opened the full loaded copy, and whether the final session saved a
// handover or was asked to.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const OUT = process.argv[2];
const T = { loads: 0, cut: 0, split: 0, part2: 0, over9000: 0, max: 0, namedDrop: 0, opened: 0, finalSaves: 0, finalAsks: 0, finalTold: 0, handovers: [] };
for (let s = 1; s <= 8; s++) {
  const d = join(OUT, `t1-cm-sonnet-s${s}-c3`);
  const sess = readdirSync(join(d, "transcripts")).map((f) => readFileSync(join(d, "transcripts", f), "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean))
    .map((lines) => ({ lines, first: lines.find((o) => o.timestamp)?.timestamp ?? "" })).sort((a, b) => a.first.localeCompare(b.first));
  T.handovers.push(JSON.parse(readFileSync(join(d, "result.json"), "utf8")).handovers);
  const row = sess.map(({ lines }, i) => {
    const raw = lines.map((o) => JSON.stringify(o)).join("\n");
    const parts = lines.filter((o) => o.attachment?.type === "hook_additional_context" && o.attachment.hookEvent === "SessionStart").flatMap((o) => [o.attachment.content].flat()).filter((c) => /cornerman: (this session continues|standing rules)/.test(c));
    const uses = lines.filter((o) => o.type === "assistant").flatMap((o) => o.message.content ?? []).filter((c) => c.type === "tool_use");
    const opened = uses.filter((c) => /cornerman\/loaded|cornerman\/artifacts|tool-results|\.start-parts/.test(JSON.stringify(c.input))).length;
    const saves = uses.filter((c) => /cornerman:handover|save\.mjs/.test(JSON.stringify(c.input))).length;
    const cut = /Output too large/.test(raw);
    const drops = parts.flatMap((p) => p.match(/[^\n.]*\bleft out\b[^\n.]*/g) ?? []);
    let out = `[${parts.map((p) => p.length).join("+") || "-"}`;
    if (parts.length) {
      T.loads++; if (cut) T.cut++;
      if (parts.length > 1) T.split++;
      if (parts.some((p) => /cornerman: standing rules for handover/.test(p))) T.part2++;
      for (const p of parts) { if (p.length > 9000) T.over9000++; T.max = Math.max(T.max, p.length); }
      if (drops.length) T.namedDrop++;
      if (opened) T.opened++;
      out += `${cut ? " CUT" : ""}${drops.length ? " drops:" + drops.length : ""}${opened ? " opened:" + opened : ""}`;
    }
    if (i === sess.length - 1) {
      const ask = lines.some((o) => o.attachment?.type === "hook_additional_context" && /Save a handover|cornerman auto mode/.test(JSON.stringify(o.attachment.content)));
      const told = lines.some((o) => o.attachment?.type === "hook_system_message" && /no clears left/.test(JSON.stringify(o.attachment.content)));
      if (saves) T.finalSaves++; if (ask) T.finalAsks++; if (told) T.finalTold++;
      out += ` final: saves ${saves}, asked ${ask ? "yes" : "no"}, told ${told ? "yes" : "no"}`;
    }
    return out + "]";
  });
  console.log(`s${s} ${row.join(" ")}`);
  for (const { lines } of sess) for (const p of lines.filter((o) => o.attachment?.type === "hook_additional_context" && o.attachment.hookEvent === "SessionStart").flatMap((o) => [o.attachment.content].flat())) for (const m of p.match(/[^\n.]*\bleft out\b[^\n.]*/g) ?? []) console.log(`     drop: ${m.trim().slice(0, 220)}`);
}
console.log(T);
