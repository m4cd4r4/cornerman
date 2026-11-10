// xcopy.mjs: book.copy(from, to) (cp68): copy a range between sheets of a workbook. References move
// as copy moves them (cp26); then unqualified ones gain the source sheet's name and ones naming the
// target sheet lose it. On one sheet, book.copy is sheet.copy.
import { parseAddress, rangeBox, rangeSize, RANGE_LIMIT } from "./address.mjs";
import { makeError } from "./errors.mjs";
import { checkName } from "./names.mjs";
import { tokenize } from "./lexer.mjs";
import { parseFormula, ParseError } from "./parser.mjs";
import { parseRef, MAX_ROW, MAX_COL } from "./refs.mjs";
import { copyWrites } from "./copy.mjs";
import { CORE } from "./sheet.mjs";

// "Name!A1" or "Name!A1:B3" -> { sheet, cells, a, b }; null when it is not written that way.
function parsePlace(text, range) {
  const parts = typeof text === "string" ? text.split("!") : [];
  if (parts.length !== 2) return null;
  try { checkName(parts[0]); } catch { return null; }
  const ends = parts[1].split(":");
  if (ends.length > (range ? 2 : 1)) return null;
  const a = parseAddress(ends[0]);
  const b = ends.length === 2 ? parseAddress(ends[1]) : a;
  return a && b ? { sheet: parts[0], cells: parts[1], a, b } : null;
}

// The input with every unqualified reference written as src!REF and the prefix dropped from every
// reference whose sheet is TGT (upper case). Values and unparseable formulas are returned as is.
export function requalify(input, src, TGT) {
  if (!input.startsWith("=")) return input;
  const body = input.slice(1);
  try {
    parseFormula(body);
  } catch (e) {
    if (e instanceof ParseError) return input;
    throw e;
  }
  const toks = tokenize(body);
  const op = (t, v) => t && t.t === "op" && t.v === v;
  const edits = [];
  toks.forEach((t, i) => {
    if (t.t !== "word" || !parseRef(t.v) || op(toks[i + 1], "(") || op(toks[i - 1], ":")) return;
    if (!op(toks[i - 1], "!")) edits.push([t.s, t.s, `${src}!`]);
    else if (toks[i - 2].v.toUpperCase() === TGT) edits.push([toks[i - 2].s, t.s, ""]);
  });
  let out = body;
  for (const [s, e, text] of edits.reverse()) out = out.slice(0, s) + text + out.slice(e);
  return "=" + out;
}

// find(name) -> index in list or -1; list = [{ name, sheet }] in creation order.
export function addBookCopy(book, find, list) {
  book.copy = (from, to) => {
    const f = parsePlace(from, true);
    if (!f) throw makeError("#ADDR", String(from), `invalid copy source: ${from}`);
    const t = parsePlace(to, false);
    if (!t) throw makeError("#ADDR", String(to), `invalid copy target: ${to}`);
    const i = find(f.sheet);
    if (i < 0) throw makeError("#SHEET", f.sheet, `no sheet named ${f.sheet}`);
    const j = find(t.sheet);
    if (j < 0) throw makeError("#SHEET", t.sheet, `no sheet named ${t.sheet}`);
    if (rangeSize(f.a.key, f.b.key) > RANGE_LIMIT) throw makeError("#ARG", from, `copy source holds more than ${RANGE_LIMIT} cells`);
    const { r1, r2, c1, c2 } = rangeBox(f.a.key, f.b.key);
    if (r2 - r1 + t.a.row > MAX_ROW || c2 - c1 + t.a.col > MAX_COL) throw makeError("#ARG", to, `copy to ${to} would pass the sheet edge`);
    const [src, tgt] = [list[i], list[j]];
    if (i === j) return src.sheet.copy(f.cells, t.cells);
    const sc = CORE.get(src.sheet);
    const tc = CORE.get(tgt.sheet);
    const w = copyWrites({ get: sc.input }, f.cells, t.cells).map(([k, x, s]) => [k, requalify(x, src.name, tgt.name.toUpperCase()), s]);
    tc.layers.locked(w); // cp71
    tc.history.group(() => {
      tc.writeRaw(w);
      tc.history.record(tc.layers.write("formats", w.map(([k, , s]) => [k, sc.layers.L.formats.get(s)])));
    });
  };
  return book;
}
