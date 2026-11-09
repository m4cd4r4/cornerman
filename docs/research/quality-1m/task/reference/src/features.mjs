// features.mjs: the sheet methods for its layers: number formats (cp41), notes (cp42),
// validation (cp46), merged ranges (cp47).
import { parseTarget, NOTE_LIMIT } from "./layers.mjs";
import { checkFormat } from "./numfmt.mjs";
import { makeError } from "./errors.mjs";
import { compareAddresses } from "./address.mjs";
import { checkRule, copyRule, passes } from "./validation.mjs";
import { mergeText, overlaps, mergeAt } from "./merges.mjs";

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
    // cp47: two or more cells, overlapping no merge. Inputs of covered cells are kept, hidden.
    merge(target) {
      const t = parseTarget(target);
      if (t.keys.length < 2) throw makeError("#MERGE", String(target), "a merge needs two or more cells");
      if (layers.L.merges.some((m) => overlaps(m, t))) throw makeError("#MERGE", String(target), `${target} overlaps a merge`);
      history.record(layers.merges([...layers.L.merges, { a: t.a, b: t.b }]));
    },
    unmerge(address) {
      const m = mergeAt(layers.L.merges, core.key(address));
      if (!m) return false;
      history.record(layers.merges(layers.L.merges.filter((x) => x !== m)));
      return true;
    },
    merges: () => layers.L.merges.map(mergeText),
    invalidCells: () => [...layers.L.rules].filter(([k, r]) => !passes(r, core.input(k) ?? "")).map(([k]) => k).sort(compareAddresses),
  });
  return sheet;
}
