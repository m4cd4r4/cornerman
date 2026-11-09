// namedefs.mjs: the sheet methods for defined names: defineName, removeName, names (cp14).
import { checkName, parseNameRef, nameText } from "./names.mjs";

export function addNames(sheet, core) {
  const { names, history } = core;
  Object.assign(sheet, {
    defineName(name, ref) {
      const n = checkName(name);
      const d = parseNameRef(ref);
      const before = names.get(n);
      if (before && JSON.stringify(before) === JSON.stringify(d)) return;
      core.setName(n, d);
      history.record({ name: n, before, after: d });
    },
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
