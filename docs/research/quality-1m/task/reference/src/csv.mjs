// csv.mjs: CSV text out (cp28) and in (cp29). Pure: index.mjs supplies the cells and applies writes.
import { parseAddress, colName } from "./address.mjs";
import { makeError, throwAddr } from "./errors.mjs";
import { MAX_ROW, MAX_COL } from "./refs.mjs";

const NEEDS_QUOTES = /[,"\r\n]|^ | $/;
const field = (s) => (NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

// keys = non-empty cell keys; text(key) = the field's text. "" for an empty sheet.
export function toCSV(keys, text) {
  let rows = 0;
  let cols = 0;
  for (const k of keys) {
    const p = parseAddress(k);
    rows = Math.max(rows, p.row);
    cols = Math.max(cols, p.col);
  }
  const lines = [];
  for (let r = 1; r <= rows; r++) {
    const out = [];
    for (let c = 1; c <= cols; c++) out.push(field(text(colName(c) + r)));
    lines.push(out.join(","));
  }
  return lines.join("\n");
}

const bad = (rec, why) => makeError("#CSV", String(rec), `CSV record ${rec}: ${why}`);

// Records as arrays of field strings. LF or CRLF ends a record; one trailing line end adds none.
export function parseCSV(text) {
  if (typeof text !== "string") throw makeError("#ARG", String(text), "CSV text must be a string");
  const records = [];
  let rec = [];
  let i = 0;
  const n = text.length;
  if (n === 0) return records;
  for (;;) {
    let f = "";
    if (text[i] === '"') {
      i++;
      for (;;) {
        if (i >= n) throw bad(records.length + 1, "unterminated quoted field");
        if (text[i] === '"') {
          if (text[i + 1] === '"') { f += '"'; i += 2; continue; }
          i++;
          break;
        }
        f += text[i++];
      }
      if (i < n && text[i] !== "," && text[i] !== "\n" && !(text[i] === "\r" && text[i + 1] === "\n")) {
        throw bad(records.length + 1, "text after a closing quote");
      }
    } else {
      while (i < n && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
        if (text[i] === '"') throw bad(records.length + 1, "quote inside an unquoted field");
        f += text[i++];
      }
      if (text[i] === "\r" && text[i + 1] !== "\n") throw bad(records.length + 1, "CR without LF");
    }
    rec.push(f);
    if (i >= n) { records.push(rec); return records; }
    if (text[i] === ",") { i++; continue; }
    i += text[i] === "\r" ? 2 : 1;
    records.push(rec);
    rec = [];
    if (i >= n) return records;
  }
}

// [[key, input]] for fromCSV, row-major. Checks at, then the text, then the sheet edge.
export function csvWrites(text, at) {
  const t = parseAddress(at);
  if (!t) throwAddr(at);
  const records = parseCSV(text);
  const width = Math.max(0, ...records.map((r) => r.length));
  if (records.length && (t.row + records.length - 1 > MAX_ROW || t.col + width - 1 > MAX_COL)) {
    throw makeError("#FULL", at, `CSV of ${records.length} x ${width} does not fit at ${at}`);
  }
  const writes = [];
  records.forEach((r, i) => r.forEach((f, j) => writes.push([colName(t.col + j) + (t.row + i), f])));
  return writes;
}
