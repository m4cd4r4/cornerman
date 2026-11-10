// fill.mjs: sheet.fillDown and sheet.fillRight (cp64). Each line of the range (a column for down,
// a row for right) takes its first cell, moved as copy moves it (cp26), or continues a series when
// its first two cells hold plain numbers. Written as set writes, so validation is checked.
import { parseTarget } from "./layers.mjs";
import { makeError } from "./errors.mjs";
import { colName, compareAddresses } from "./address.mjs";
import { overlaps } from "./merges.mjs";
import { roundDecimal, plainDecimal } from "./decimal.mjs";
import { shiftFormula } from "./copy.mjs";

const NUMBER = /^-?\d+(\.\d+)?$/; // the cp01 number grammar
const numberText = (n) => (n < 0 ? "-" + plainDecimal(-n) : plainDecimal(n));

// [[key, input, source key]] for one line; keys[0] is the source, move(input, n) shifts it n cells.
function lineWrites(keys, input, move) {
  const a = input(keys[0]) ?? "";
  const b = keys.length > 1 ? input(keys[1]) ?? "" : "";
  if (keys.length > 1 && NUMBER.test(a) && NUMBER.test(b)) {
    const x = Number(a);
    const step = Number(b) - x;
    return keys.slice(2).map((k, i) => [k, numberText(roundDecimal(x + (i + 2) * step, 10, "even")), keys[0]]);
  }
  return keys.slice(1).map((k, i) => [k, move(a, i + 1), keys[0]]);
}

export function addFill(sheet, core) {
  const { layers, history } = core;
  // Checks in order: target (#ADDR, #ARG), merges (#MERGE), then every written input (#INVALID).
  function fill(target, down) {
    const t = parseTarget(target);
    if (layers.L.merges.some((m) => overlaps(m, t))) throw makeError("#MERGE", String(target), `${target} overlaps a merge`);
    const writes = [];
    const [from, to] = down ? [t.c1, t.c2] : [t.r1, t.r2];
    for (let line = from; line <= to; line++) {
      const keys = [];
      if (down) for (let r = t.r1; r <= t.r2; r++) keys.push(colName(line) + r);
      else for (let c = t.c1; c <= t.c2; c++) keys.push(colName(c) + line);
      writes.push(...lineWrites(keys, core.input, (raw, n) => (down ? shiftFormula(raw, n, 0) : shiftFormula(raw, 0, n))));
    }
    writes.sort((x, y) => compareAddresses(x[0], y[0]));
    history.group(() => {
      core.writeAll(writes);
      history.record(layers.write("formats", writes.map(([k, , s]) => [k, layers.L.formats.get(s)])));
    });
  }
  Object.assign(sheet, {
    fillDown: (target) => fill(target, true),
    fillRight: (target) => fill(target, false),
  });
  return sheet;
}
