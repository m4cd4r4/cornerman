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

// cp37: input with every `Old!` sheet prefix (matched ignoring case, OLD = upper-cased old name)
// written as `next`. Other text, values and unparseable formulas are returned unchanged.
export function renameRefs(input, OLD, next) {
  if (!input.startsWith("=")) return input;
  const src = input.slice(1);
  try {
    parseFormula(src);
  } catch (e) {
    if (e instanceof ParseError) return input;
    throw e;
  }
  const toks = tokenize(src);
  let out = src;
  for (let i = toks.length - 2; i >= 0; i--) {
    const t = toks[i];
    const nx = toks[i + 1];
    if (t.t === "word" && nx.t === "op" && nx.v === "!" && t.v.toUpperCase() === OLD) out = out.slice(0, t.s) + next + out.slice(t.e);
  }
  return "=" + out;
}

// cp54: input with every reference whose sheet prefix is OLD (upper case, matched ignoring case)
// written as #REF!: a cell, or a whole range with its prefix, corners and colon.
export function dropSheetRefs(input, OLD) {
  if (!input.startsWith("=")) return input;
  const src = input.slice(1);
  try {
    parseFormula(src);
  } catch (e) {
    if (e instanceof ParseError) return input;
    throw e;
  }
  const toks = tokenize(src);
  let out = src;
  for (let i = toks.length - 3; i >= 0; i--) {
    const t = toks[i];
    if (t.t !== "word" || toks[i + 1].t !== "op" || toks[i + 1].v !== "!" || t.v.toUpperCase() !== OLD) continue;
    const colon = toks[i + 3];
    const end = colon && colon.t === "op" && colon.v === ":" ? toks[i + 4] : toks[i + 2];
    out = out.slice(0, t.s) + "#REF!" + out.slice(end.e);
  }
  return "=" + out;
}

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
// With qualified false, references with a sheet name (Data!A1, cp31) are left as typed.
export function rewriteRefs(src, one, range, qualified = true) {
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
    const prev = toks[i - 1];
    const named = prev && prev.t === "op" && prev.v === "!";
    if (!qualified && named) {
      const nx = toks[i + 1];
      if (nx && nx.t === "op" && nx.v === ":") i += 2;
      continue;
    }
    const from = named ? toks[i - 2].s : toks[i].s; // #REF! replaces the sheet name too
    const colon = toks[i + 1];
    const b = colon && colon.t === "op" && colon.v === ":" ? refAt(toks, i + 2) : null;
    if (!b) {
      const q = one(a);
      if (q === null) edits.push([from, toks[i].e, "#REF!"]);
      else if (moved(a, q)) edits.push([toks[i].s, toks[i].e, refText(q)]);
      continue;
    }
    const end = toks[i + 2];
    const m = range(a, b);
    if (m === null) edits.push([from, end.e, "#REF!"]);
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
