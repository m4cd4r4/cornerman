// namedefs.mjs: the sheet methods for defined names: defineName, removeName, names (cp14), and
// defineConstant (cp52), which shares their one namespace.
import { checkName, parseNameRef, nameText, checkConstant } from "./names.mjs";

export function addNames(sheet, core) {
  const { names, history } = core;
  // One undo step, unless the name already has exactly this target or value.
  function define(n, target) {
    const d = target();
    const before = names.get(n);
    if (before && JSON.stringify(before) === JSON.stringify(d)) return;
    core.setName(n, d);
    history.record({ name: n, before, after: d });
  }
  Object.assign(sheet, {
    defineName: (name, ref) => define(checkName(name), () => parseNameRef(ref)),
    defineConstant: (name, value) => define(checkName(name), () => checkConstant(value)),
    removeName(name) {
      const n = typeof name === "string" ? name.toUpperCase() : "";
      if (!names.has(n)) return false;
      history.record({ name: n, before: names.get(n), after: undefined });
      core.setName(n, undefined);
      return true;
    },
    names() {
      const out = {};
      for (const n of [...names.keys()].sort()) out[n] = nameText(names.get(n));
      return out;
    },
  });
  return sheet;
}
