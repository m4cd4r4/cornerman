import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const OUT = process.argv[2];
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return (s[3] + s[4]) / 2; };
const rows = {};
for (const arm of ["full", "compact", "cm", "floor"]) {
  rows[arm] = [];
  for (let s = 1; s <= 8; s++) {
    const d = join(OUT, `t1-${arm}-sonnet-s${s}-c3`);
    const seen = new Set(); const t = { in: 0, cw: 0, cr: 0, out: 0, peak: 0, calls: 0 };
    for (const f of readdirSync(join(d, "transcripts"))) for (const line of readFileSync(join(d, "transcripts", f), "utf8").split("\n")) {
      if (!line.includes('"usage"')) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      const u = o.message?.usage, id = o.message?.id; if (!u || !id || seen.has(id) || o.isSidechain) continue; seen.add(id);
      t.in += u.input_tokens || 0; t.cw += u.cache_creation_input_tokens || 0; t.cr += u.cache_read_input_tokens || 0; t.out += u.output_tokens || 0; t.calls++;
      t.peak = Math.max(t.peak, (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0));
    }
    const log = readFileSync(join(d, "driver.log"), "utf8").trim().split("\n");
    t.mins = (Date.parse(log.at(-1).slice(0, 24)) - Date.parse(log[0].slice(0, 24))) / 60000;
    t.processed = t.in + t.cw + t.cr; t.cost = t.in + 1.25 * t.cw + 0.1 * t.cr + 5 * t.out; // input-token equivalents
    rows[arm].push(t);
  }
}
const k = (x) => (x / 1000).toFixed(0) + "k";
console.log("arm | calls | input processed | of which cache read | output | cost (input-equiv) | peak context | minutes   (median of 8)");
for (const [arm, r] of Object.entries(rows)) console.log([arm, med(r.map((x) => x.calls)), k(med(r.map((x) => x.processed))), k(med(r.map((x) => x.cr))), k(med(r.map((x) => x.out))), k(med(r.map((x) => x.cost))), k(med(r.map((x) => x.peak))), med(r.map((x) => x.mins)).toFixed(0)].join(" | "));
const base = med(rows.full.map((x) => x.cost));
for (const arm of ["compact", "cm", "floor"]) console.log(arm, "cost vs full:", (100 * med(rows[arm].map((x) => x.cost)) / base).toFixed(0) + "%", "per seed:", rows[arm].map((x, i) => (100 * x.cost / rows.full[i].cost).toFixed(0)).join(" "));
