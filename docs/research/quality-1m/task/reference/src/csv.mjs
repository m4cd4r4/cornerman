// csv.mjs: CSV text out (cp28) and in (cp29). Pure: index.mjs supplies the cells and applies writes.
import { parseAddress, colName } from "./address.mjs";
import { makeError, throwAddr } from "./errors.mjs";
import { MAX_ROW, MAX_COL } from "./refs.mjs";

const NEEDS_QUOTES = /[,"\r\n]|^ | $/;
const field = (s) => (NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

// keys = non-empty cell keys; text(key) = the field's text. "" for an empty sheet. hidden.rows and
// hidden.cols (cp49): row and column numbers left out of the text entirely.
export function toCSV(keys, text, hidden = { rows: new Map(), cols: new Map() }) {
  let rows = 0;
  let cols = 0;
  for (const k of keys) {
    const p = parseAddress(k);
    rows = Math.max(rows, p.row);
    cols = Math.max(cols, p.col);
  }
  const shown = [];
  for (let c = 1; c <= cols; c++) if (!hidden.cols.has(c)) shown.push(c);
  if (!shown.length) return "";
  const lines = [];
  for (let r = 1; r <= rows; r++) {
    if (hidden.rows.has(r)) continue;
    lines.push(shown.map((c) => field(text(colName(c) + r))).join(","));
  }
  return lines.join("\n");
}

const bad = (rec, why) => makeError("#CSV", String(rec), `CSV record ${rec}: ${why}`);

// Records as arrays of field strings. LF or CRLF ends a record; one trailing line end adds none.
// d is the field delimiter (cp69): one character other than a quote, CR or LF.
export function parseCSV(text, d = ",") {
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
      if (i < n && text[i] !== d && text[i] !== "\n" && !(text[i] === "\r" && text[i + 1] === "\n")) {
        throw bad(records.length + 1, "text after a closing quote");
      }
    } else {
      while (i < n && text[i] !== d && text[i] !== "\n" && text[i] !== "\r") {
        if (text[i] === '"') throw bad(records.length + 1, "quote inside an unquoted field");
        f += text[i++];
      }
      if (text[i] === "\r" && text[i + 1] !== "\n") throw bad(records.length + 1, "CR without LF");
    }
    rec.push(f);
    if (i >= n) { records.push(rec); return records; }
    if (text[i] === d) { i++; continue; }
    i += text[i] === "\r" ? 2 : 1;
    records.push(rec);
    rec = [];
    if (i >= n) return records;
  }
}

// cp69: { delimiter, header, types } from fromCSV's opts; throws #ARG. Other keys are ignored.
function csvOptions(opts) {
  if (opts === undefined) return { delimiter: ",", header: false, types: "auto" };
  if (opts === null || typeof opts !== "object" || Array.isArray(opts)) throw makeError("#ARG", "opts", "opts must be an object");
  const { delimiter = ",", header = false, types = "auto" } = opts;
  if (typeof delimiter !== "string" || delimiter.length !== 1 || '"\r\n'.includes(delimiter)) throw makeError("#ARG", String(delimiter), `bad delimiter ${delimiter}`);
  if (typeof header !== "boolean") throw makeError("#ARG", String(header), "header must be true or false");
  if (types !== "auto" && types !== "text") throw makeError("#ARG", String(types), `unknown types ${types}`);
  return { delimiter, header, types };
}

// cp69, types "text": a field that would read as a number or a formula becomes a text formula.
const NUMBER = /^-?\d+(\.\d+)?$/;
const asText = (f) => (NUMBER.test(f) || f.startsWith("=") ? `="${f.replaceAll('"', '""')}"` : f);

// [[key, input]] for fromCSV, row-major. Checks at, then opts (cp69), then the text, then the sheet
// edge. With header, the first record is not written; it is the array's `header` (null if none).
export function csvWrites(text, at, opts) {
  const t = parseAddress(at);
  if (!t) throwAddr(at);
  const o = csvOptions(opts);
  const all = parseCSV(text, o.delimiter);
  const records = (o.header ? all.slice(1) : all).map((r) => (o.types === "text" ? r.map(asText) : r));
  const width = Math.max(0, ...records.map((r) => r.length));
  if (records.length && (t.row + records.length - 1 > MAX_ROW || t.col + width - 1 > MAX_COL)) {
    throw makeError("#FULL", at, `CSV of ${records.length} x ${width} does not fit at ${at}`);
  }
  const writes = [];
  records.forEach((r, i) => r.forEach((f, j) => writes.push([colName(t.col + j) + (t.row + i), f])));
  if (o.header) writes.header = all.length ? [...all[0]] : null;
  return writes;
}
