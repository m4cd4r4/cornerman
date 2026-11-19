// node stage-a2-marks.mjs <out>: in the final loaded copy of each cm trial, the user-words log section only:
// every line holding a reversed fact's old wording, printed whole, with whether it carries a mark.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const OUT = process.argv[2];
let facts = 0, bad = 0, nolog = 0;
for (let s = 1; s <= 8; s++) {
  const d = join(OUT, `t1-cm-sonnet-s${s}-c3`);
  const rev = JSON.parse(readFileSync(join(d, "facts.json"), "utf8")).filter((f) => f.type === "reversed");
  const files = readdirSync(join(d, "cm", "loaded")).map((f) => join(d, "cm", "loaded", f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  const text = readFileSync(files.at(-1), "utf8");
  const at = text.search(/What the user typed|Rulings from the user/);
  const log = at < 0 ? "" : text.slice(at);
  console.log(`s${s}: log section ${log.length} chars of ${text.length}; heading: ${log.split("\n")[0].slice(0, 160)}`);
  for (const f of rev) {
    facts++;
    const old = log.split("\n").filter((l) => (f.absent ?? []).some((re) => new RegExp(re, "i").test(l)));
    if (!old.length) { nolog++; console.log(`   ${f.id}: old wording not in the log`); continue; }
    let b = 0;
    for (const l of old) { const m = /replaced/i.test(l); if (!m) b++; console.log(`   ${f.id} ${m ? "marked  " : "UNMARKED"} | ${l.trim().slice(0, 240)}`); }
    if (b) bad++;
  }
}
console.log({ facts, factsWithUnmarkedLogLine: bad, oldWordingNotInLog: nolog });
