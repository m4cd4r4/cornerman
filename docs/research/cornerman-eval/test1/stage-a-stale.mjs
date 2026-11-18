// node stale3.mjs <out>: A9. In the full context cornerman gave the final session (its saved copy
// under cm/loaded, newest file), is each reversed fact's old wording marked as replaced?
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const OUT = process.argv[2];
const tot = { facts: 0, factsWithUnmarked: 0, marked: 0, unmarked: 0, newPresent: 0 };
for (let s = 1; s <= 8; s++) {
  const d = join(OUT, `t1-cm-sonnet-s${s}-c3`);
  const facts = JSON.parse(readFileSync(join(d, "facts.json"), "utf8")).filter((f) => f.type === "reversed");
  const files = readdirSync(join(d, "cm", "loaded")).map((f) => join(d, "cm", "loaded", f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  const text = readFileSync(files.at(-1), "utf8");
  console.log(`s${s}: ${files.length} loaded, final ${text.length} chars`);
  for (const f of facts) {
    tot.facts++;
    if ((f.written ?? []).every((re) => new RegExp(re, "i").test(text))) tot.newPresent++;
    const old = text.split("\n").filter((l) => (f.absent ?? []).some((re) => new RegExp(re, "i").test(l)));
    let bad = 0;
    for (const h of old) {
      const m = /replaced by a later one|corrected from|changed from|, not |instead of|was |no longer|still has/i.test(h);
      m ? tot.marked++ : (tot.unmarked++, bad++);
      if (!m) console.log(`   ${f.id} UNMARKED | ${h.trim().slice(0, 200)}`);
    }
    if (bad) tot.factsWithUnmarked++;
  }
}
console.log(tot);
