// save3.mjs: workbook save format v3 (cp56): each sheet's formats (cp41), validation rules (cp46),
// merges (cp47) and hidden rows and columns (cp49) beside its cells, names and notes. Written only
// when some sheet has one of those layers; otherwise book.save() writes v2 exactly as before.
import { normalise, compareAddresses, colName } from "./address.mjs";
import { parseFormat } from "./numfmt.mjs";
import { checkRule, copyRule } from "./validation.mjs";
import { parseTarget } from "./layers.mjs";
import { mergeText, overlaps } from "./merges.mjs";
import { parseRef } from "./refs.mjs";
import { bad, isPlain } from "./persist.mjs";

export const hasV3Layers = (L) => L.formats.size > 0 || L.rules.size > 0 || L.merges.length > 0 || L.rows.size > 0 || L.cols.size > 0;

const byAddress = (map, f = (v) => v) => Object.fromEntries([...map.keys()].sort(compareAddresses).map((k) => [k, f(map.get(k))]));
const numbers = (map) => [...map.keys()].sort((a, b) => a - b);

// One sheet entry of a workbook save. saved = { cells, names, notes? } as the sheet's own save()
// writes them; L = the sheet's layers.
export function sheetEntry(name, saved, L, v3) {
  const { cells, names, notes } = saved;
  if (!v3) return notes ? { name, cells, names, notes } : { name, cells, names };
  return {
    name, cells, names, notes: notes || {},
    formats: byAddress(L.formats),
    rules: byAddress(L.rules, copyRule),
    merges: L.merges.map(mergeText),
    hiddenRows: numbers(L.rows),
    hiddenCols: numbers(L.cols).map(colName),
  };
}

// The v3 layers of sheet entry s (at = "sheets.N"), checked in the stated order; throws #LOAD.
export function parseLayers(s, at) {
  const out = { formats: new Map(), rules: new Map(), merges: [], rows: new Map(), cols: new Map() };
  const object = (key, check) => {
    if (!isPlain(s[key])) throw bad(`${at}.${key}`, `${at}.${key} must be an object`);
    for (const [k, v] of Object.entries(s[key])) {
      if (normalise(k) !== k || !check(v)) throw bad(`${at}.${key}.${k}`, `${at}.${key}.${k} is not valid`);
      out[key].set(k, v);
    }
  };
  const array = (key, check) => {
    if (!Array.isArray(s[key])) throw bad(`${at}.${key}`, `${at}.${key} must be an array`);
    s[key].forEach((v, i) => { if (!check(v, i)) throw bad(`${at}.${key}.${i}`, `${at}.${key}.${i} is not valid`); });
  };
  object("formats", (v) => typeof v === "string" && parseFormat(v) !== null);
  object("rules", (v) => {
    try {
      return JSON.stringify(checkRule(v, "")) === JSON.stringify(v);
    } catch {
      return false;
    }
  });
  array("merges", (v) => {
    let t;
    try { t = parseTarget(v); } catch { return false; }
    const prev = out.merges[out.merges.length - 1];
    if (`${t.a}:${t.b}` !== v || t.keys.length < 2 || out.merges.some((m) => overlaps(m, t))) return false;
    if (prev && compareAddresses(prev.a, t.a) >= 0) return false;
    out.merges.push({ a: t.a, b: t.b });
    return true;
  });
  array("hiddenRows", (v, i) => Number.isInteger(v) && v >= 1 && v <= 9999 && (i === 0 || v > s.hiddenRows[i - 1]) && out.rows.set(v, true));
  const col = (v) => (typeof v === "string" && /^[A-Z]{1,2}$/.test(v) ? parseRef(v + "1").col : NaN);
  array("hiddenCols", (v, i) => col(v) > 0 && (i === 0 || col(v) > col(s.hiddenCols[i - 1])) && out.cols.set(col(v), true));
  return out;
}
