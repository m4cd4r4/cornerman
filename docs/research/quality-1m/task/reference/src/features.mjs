// features.mjs: the sheet methods for its per-cell layers: number formats (cp41), notes (cp42),
// validation (cp46).
import { parseTarget, NOTE_LIMIT } from "./layers.mjs";
import { checkFormat } from "./numfmt.mjs";
import { makeError } from "./errors.mjs";
import { compareAddresses } from "./address.mjs";
import { checkRule, copyRule, passes } from "./validation.mjs";

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
    // cp46: existing inputs are not checked; one undo step; null clears.
    setValidation(target, rule) {
      const t = parseTarget(target);
      const r = checkRule(rule, target);
      history.record(layers.write("rules", t.keys.map((k) => [k, r])));
    },
    getValidation(address) {
      const r = layers.L.rules.get(core.key(address));
      return r ? copyRule(r) : null;
    },
    invalidCells: () => [...layers.L.rules].filter(([k, r]) => !passes(r, core.input(k) ?? "")).map(([k]) => k).sort(compareAddresses),
  });
  return sheet;
}
