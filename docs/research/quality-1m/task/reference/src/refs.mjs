// refs.mjs: reference tokens in formula text, and rewriting them in place (cp23-cp26).
import { colName } from "./address.mjs";
import { tokenize } from "./lexer.mjs";
import { parseFormula, ParseError } from "./parser.mjs";

export const MAX_ROW = 9999;
export const MAX_COL = 702; // ZZ

const REF = /^(\$?)([A-Za-z]{1,2})(\$?)([1-9]\d{0,3})$/;

// { col, row, absCol, absRow } for a reference such as b7 or $B$7, or null.
export function parseRef(text) {
  const m = REF.exec(text);
  if (!m) return null;
  let col = 0;
  for (const ch of m[2].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(m[4]), absCol: m[1] === "$", absRow: m[3] === "$" };
}

export const refText = (p) => `${p.absCol ? "$" : ""}${colName(p.col)}${p.absRow ? "$" : ""}${p.row}`;
export const onSheet = (p) => p.row >= 1 && p.row <= MAX_ROW && p.col >= 1 && p.col <= MAX_COL;

// A reference token: an address word that is not a function name.
function refAt(toks, i) {
  const t = toks[i];
  if (!t || t.t !== "word") return null;
  const nx = toks[i + 1];
  if (nx && nx.t === "op" && nx.v === "(") return null;
  return parseRef(t.v);
}

// one(p) -> p | null, range(a, b) -> [a, b] | null, with a and b as typed. null writes #REF!
// (for a range, over both corners and the colon). A reference that changes is written upper
// case; everything else keeps its typed text. Unparseable formulas are returned unchanged.
export function rewriteRefs(src, one, range) {
  try {
    parseFormula(src);
  } catch (e) {
    if (e instanceof ParseError) return src;
    throw e;
  }
  const toks = tokenize(src);
  const edits = [];
  const moved = (p, q) => p.col !== q.col || p.row !== q.row;
  for (let i = 0; i < toks.length; i++) {
    const a = refAt(toks, i);
    if (!a) continue;
    const colon = toks[i + 1];
    const b = colon && colon.t === "op" && colon.v === ":" ? refAt(toks, i + 2) : null;
    if (!b) {
      const q = one(a);
      if (q === null) edits.push([toks[i].s, toks[i].e, "#REF!"]);
      else if (moved(a, q)) edits.push([toks[i].s, toks[i].e, refText(q)]);
      continue;
    }
    const end = toks[i + 2];
    const m = range(a, b);
    if (m === null) edits.push([toks[i].s, end.e, "#REF!"]);
    else {
      if (moved(a, m[0])) edits.push([toks[i].s, toks[i].e, refText(m[0])]);
      if (moved(b, m[1])) edits.push([end.s, end.e, refText(m[1])]);
    }
    i += 2;
  }
  let out = src;
  for (const [s, e, text] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, s) + text + out.slice(e);
  return out;
}
