// features.mjs: the sheet methods for its per-cell layers: number formats (cp41), notes (cp42).
import { parseTarget, NOTE_LIMIT } from "./layers.mjs";
import { checkFormat } from "./numfmt.mjs";
import { makeError } from "./errors.mjs";
import { compareAddresses } from "./address.mjs";

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
    // cp42: trimmed text; "" after trimming removes the note.
    setNote(address, text) {
      const k = core.key(address);
      if (typeof text !== "string") throw makeError("#NOTE", k, "a note must be text");
      const t = text.trim();
      if (t.length > NOTE_LIMIT) throw makeError("#NOTE", k, `a note holds at most ${NOTE_LIMIT} characters`);
      history.record(layers.write("notes", [[k, t === "" ? undefined : t]]));
    },
    getNote: (address) => layers.L.notes.get(core.key(address)) ?? null,
    notes() {
      const out = {};
      for (const k of [...layers.L.notes.keys()].sort(compareAddresses)) out[k] = layers.L.notes.get(k);
      return out;
    },
  });
  return sheet;
}
