// protect.mjs: protected cells (cp71). A lock is a cell layer: it moves with insert and delete and
// is in structural snapshots, but protect and unprotect are not undo steps and locks are not saved.
// Writes that would change a locked cell's input are refused (layers.check, layers.locked).
import { parseTarget } from "./layers.mjs";
import { compareAddresses } from "./address.mjs";

export function addProtection(sheet, core) {
  const { layers } = core;
  layers.readInputs((k) => core.input(k) ?? "");
  const lock = (target, on) => {
    const t = parseTarget(target);
    layers.write("locks", t.keys.map((k) => [k, on ? true : undefined])); // not recorded for undo
  };
  Object.assign(sheet, {
    protect: (target) => lock(target, true),
    unprotect: (target) => lock(target, false),
    isProtected: (address) => layers.L.locks.has(core.key(address)),
    protectedCells: () => [...layers.L.locks.keys()].sort(compareAddresses),
  });
  return sheet;
}
