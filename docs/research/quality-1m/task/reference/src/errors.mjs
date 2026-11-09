// errors.mjs: error values and the priority order (cp02, cp04, cp09; later checkpoints add codes).
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
  let best = null;
  for (const e of errors) {
    if (!isError(e)) continue;
    if (best === null) { best = e; continue; }
    const d = rank(e.code) - rank(best.code);
    if (d < 0 || (d === 0 && compareAddresses(e.cell, best.cell) < 0)) best = e;
  }
  return best;
}

export function throwAddr(address) {
  throw makeError("#ADDR", address, `invalid address: ${address}`);
}
