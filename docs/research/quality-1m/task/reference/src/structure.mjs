// structure.mjs: insert and delete rows, with formula-text rewriting (cp23, cp24).
// Works on the raw inputs and names; index.mjs swaps the result in and rebuilds.
import { parseAddress, colName } from "./address.mjs";
import { makeError } from "./errors.mjs";
import { tokenize } from "./lexer.mjs";
import { parseFormula, ParseError } from "./parser.mjs";

const MAX_ROW = 9999;
const REFLIKE = /^[A-Za-z]{1,2}\d+$/;

function checkArgs(at, count) {
  const ok = Number.isInteger(at) && Number.isInteger(count) && at >= 1 && at <= MAX_ROW && count >= 1 && at + count - 1 <= MAX_ROW;
  if (!ok) throw makeError("#ARG", String(at), `invalid row arguments: at=${at} count=${count}`);
}

// A ref token: an A1 address word that is not a function name.
function refAt(toks, i) {
  const t = toks[i];
  if (!t || t.t !== "word" || !REFLIKE.test(t.v)) return null;
  const nx = toks[i + 1];
  if (nx && nx.t === "op" && nx.v === "(") return null;
  return parseAddress(t.v);
}

// mapper: { one(row) -> row | null, range(r1, r2) -> [r1, r2] | null } where r1 <= r2.
// Moved refs are written upper case; refs that stay keep their typed text.
function rewrite(src, mapper) {
  try {
    parseFormula(src);
  } catch (e) {
    if (e instanceof ParseError) return src; // unparseable text is left as typed
    throw e;
  }
  const toks = tokenize(src);
  const edits = [];
  for (let i = 0; i < toks.length; i++) {
    const a = refAt(toks, i);
    if (!a) {
      // #REF!:A5 stays broken as typed.
      if (toks[i].t === "referr" && toks[i + 1]?.v === ":" && toks[i + 2]) i += 2;
      continue;
    }
    const colon = toks[i + 1];
    const b = colon && colon.t === "op" && colon.v === ":" ? refAt(toks, i + 2) : null;
    if (!b) {
      const r = mapper.one(a.row);
      if (r === null) edits.push([toks[i].s, toks[i].e, "#REF!"]);
      else if (r !== a.row) edits.push([toks[i].s, toks[i].e, colName(a.col) + r]);
      continue;
    }
    const top = Math.min(a.row, b.row);
    const bot = Math.max(a.row, b.row);
    const m = mapper.range(top, bot);
    const end = toks[i + 2];
    if (m === null) edits.push([toks[i].s, end.e, "#REF!"]);
    else {
      // Each typed corner keeps its role (top or bottom) even if typed bottom-first.
      const fix = (p, tok) => {
        const r = p.row === top ? m[0] : m[1];
        if (r !== p.row) edits.push([tok.s, tok.e, colName(p.col) + r]);
      };
      fix(a, toks[i]);
      fix(b, end);
    }
    i += 2;
  }
  let out = src;
  for (const [s, e, text] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, s) + text + out.slice(e);
  return out;
}

function apply(inputs, names, moveRow, mapper) {
  const nextInputs = new Map();
  for (const [k, raw] of inputs) {
    const p = parseAddress(k);
    const r = moveRow(p.row);
    if (r === null) continue;
    nextInputs.set(colName(p.col) + r, raw.startsWith("=") ? "=" + rewrite(raw.slice(1), mapper) : raw);
  }
  const nextNames = new Map();
  for (const [n, d] of names) {
    const a = parseAddress(d.a);
    const b = parseAddress(d.b);
    const m = mapper.range(a.row, b.row);
    if (m === null) continue;
    nextNames.set(n, { a: colName(a.col) + m[0], b: colName(b.col) + m[1], range: d.range });
  }
  return { inputs: nextInputs, names: nextNames };
}

export function insertRows(inputs, names, at, count) {
  checkArgs(at, count);
  for (const k of inputs.keys()) {
    const row = parseAddress(k).row;
    if (row >= at && row + count > MAX_ROW) {
      throw makeError("#FULL", String(at), `inserting ${count} row(s) would push ${k} past row ${MAX_ROW}`);
    }
  }
  const shift = (r) => (r >= at ? r + count : r);
  const one = (r) => (shift(r) > MAX_ROW ? null : shift(r));
  const range = (r1, r2) => {
    const a = one(r1);
    const b = one(r2);
    return a === null || b === null ? null : [a, b];
  };
  return apply(inputs, names, one, { one, range });
}

export function deleteRows(inputs, names, at, count) {
  checkArgs(at, count);
  const last = at + count - 1;
  const one = (r) => (r < at ? r : r > last ? r - count : null);
  const range = (r1, r2) => {
    if (r1 >= at && r2 <= last) return null;
    const a = r1 >= at && r1 <= last ? at : one(r1);
    const b = r2 >= at && r2 <= last ? at - 1 : one(r2);
    return [a, b];
  };
  return apply(inputs, names, one, { one, range });
}
