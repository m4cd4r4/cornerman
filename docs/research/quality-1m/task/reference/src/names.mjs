// names.mjs: rules for defined names and the cells they point at (cp14).
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
  return d.range ? `${d.a}:${d.b}` : d.a;
}
