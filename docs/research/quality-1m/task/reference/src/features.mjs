// features.mjs: the sheet methods for its per-cell layers: number formats (cp41).
import { parseTarget } from "./layers.mjs";
import { checkFormat } from "./numfmt.mjs";

export function addFeatures(sheet, core) {
  const { layers, history } = core;
  Object.assign(sheet, {
    // One undo step for the whole target; null or "" clears.
    setFormat(target, format) {
      const t = parseTarget(target);
      const f = checkFormat(format) ?? undefined;
      history.record(layers.write("formats", t.keys.map((k) => [k, f])));
    },
    getFormat: (address) => layers.L.formats.get(core.key(address)) ?? null,
  });
  return sheet;
}
