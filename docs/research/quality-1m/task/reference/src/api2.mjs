// api2.mjs: the version 2 method names (cp33), added beside the version 1 names they alias.
import { makeError } from "./errors.mjs";

export function addV2(sheet, core) {
  Object.assign(sheet, {
    setCell: (address, input) => sheet.set(address, input),
    value: (address) => sheet.get(address),
    text: (address) => sheet.display(address),
    addresses: () => sheet.cells(),
    formula: (address) => sheet.getInput(address) ?? "",
    // Every address is checked before anything is written; the writes are one undo step.
    setMany(cells) {
      if (cells === null || typeof cells !== "object" || Array.isArray(cells)) throw makeError("#ARG", "", "setMany takes an object");
      const writes = Object.entries(cells).map(([a, input]) => [core.key(a), input]);
      core.writeAll(writes);
    },
  });
  return sheet;
}
