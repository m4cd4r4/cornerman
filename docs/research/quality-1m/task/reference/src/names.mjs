// names.mjs: rules for defined names and the cells they point at (cp14), and named constants (cp52):
// a target { a, b, range } or a constant { value }.
import { parseAddress, rangeSize, rangeBox, colName, RANGE_LIMIT } from "./address.mjs";
import { makeError } from "./errors.mjs";

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Upper-case name, or throws #BADNAME.
export function checkName(name) {
  const ok = typeof name === "string" && NAME.test(name) && !/^[A-Za-z]+\d+$/.test(name) && !/^(TRUE|FALSE)$/i.test(name);
  if (!ok) throw makeError("#BADNAME", String(name), `invalid name: ${name}`);
  return name.toUpperCase();
}

// { a, b, range } with a = top-left and b = bottom-right, or throws #ADDR with cell = ref.
export function parseNameRef(ref) {
  const bad = () => { throw makeError("#ADDR", String(ref), `invalid reference: ${ref}`); };
  if (typeof ref !== "string") bad();
  const parts = ref.split(":");
  if (parts.length > 2) bad();
  const a = parseAddress(parts[0]);
  if (!a) bad();
  if (parts.length === 1) return { a: a.key, b: a.key, range: false };
  const b = parseAddress(parts[1]);
  if (!b) bad();
  if (rangeSize(a.key, b.key) > RANGE_LIMIT) bad();
  const { r1, r2, c1, c2 } = rangeBox(a.key, b.key);
  return { a: colName(c1) + r1, b: colName(c2) + r2, range: true };
}

export function nameText(d) {
  if ("value" in d) return constantText(d.value);
  const cells = d.range ? `${d.a}:${d.b}` : d.a;
  return d.sheet ? `${d.sheet}!${cells}` : cells; // cp53: a workbook name's target names its sheet
}

// cp52: { value } for a defineConstant value: a finite number, a string or a boolean. Throws #ARG.
export function checkConstant(value) {
  const ok = typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
  if (!ok) throw makeError("#ARG", String(value), `not a constant: ${value}`);
  return { value: value === 0 ? 0 : value };
}

// "=0.25", '="a ""b"""', "=TRUE": how names() writes a constant.
function constantText(v) {
  if (typeof v === "boolean") return v ? "=TRUE" : "=FALSE";
  if (typeof v === "string") return `="${v.replaceAll('"', '""')}"`;
  return `=${String(v)}`;
}

// The constant written by constantText, or throws. Callers check the text round-trips.
export function parseConstant(text) {
  const t = text.slice(1);
  if (t === "TRUE" || t === "FALSE") return { value: t === "TRUE" };
  const m = /^"((?:[^"]|"")*)"$/.exec(t);
  if (m) return { value: m[1].replaceAll('""', '"') };
  const n = Number(t);
  if (t.trim() !== "" && Number.isFinite(n)) return { value: n };
  throw new Error(`not a constant: ${text}`);
}
