// errors.mjs: error values, the priority order and the opt-in reading order (cp02, cp04, cp09, cp34).
import { compareAddresses } from "./address.mjs";

// Highest priority first.
export const PRIORITY = ["#CYCLE!", "#REF!", "#NAME?", "#N/A", "#VALUE!", "#DIV/0!"];

export function makeError(code, cell, message) {
  return { code, cell, message: message || code };
}

export function isError(v) {
  return v !== null && typeof v === "object" && typeof v.code === "string" && "cell" in v;
}

function rank(code) {
  const i = PRIORITY.indexOf(code);
  return i === -1 ? PRIORITY.length : i;
}

// The winning error among candidates (cp04): highest priority, then row-major origin.
export function pickError(errors) {
  if (ORDER === "first") return errors.find(isError) ?? null;
  let best = null;
  for (const e of errors) {
    if (!isError(e)) continue;
    if (best === null) { best = e; continue; }
    const d = rank(e.code) - rank(best.code);
    if (d < 0 || (d === 0 && compareAddresses(e.cell, best.cell) < 0)) best = e;
  }
  return best;
}

// cp34: the error order in force while a formula is evaluated ("priority" or "first").
let ORDER = "priority";
export function withErrorOrder(order, fn) {
  const before = ORDER;
  ORDER = order;
  try {
    return fn();
  } finally {
    ORDER = before;
  }
}

// The errorOrder option of createSheet, loadSheet and createWorkbook; throws #ARG if invalid.
export function errorOrderOption(opts) {
  if (opts === undefined) return "priority";
  if (opts === null || typeof opts !== "object" || Array.isArray(opts)) throw makeError("#ARG", "", "options must be an object");
  const o = opts.errorOrder;
  if (o === undefined) return "priority";
  if (o !== "priority" && o !== "first") throw makeError("#ARG", String(o), `unknown errorOrder ${o}`);
  return o;
}

export function throwAddr(address) {
  throw makeError("#ADDR", address, `invalid address: ${address}`);
}
