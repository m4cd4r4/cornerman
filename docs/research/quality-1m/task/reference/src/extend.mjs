// extend.mjs: the sheet methods added beside sheet.mjs's own, in the order they wrap each other:
// layer features, names, hiding, find and replace, fills, the v2 and v3 names, change events (every
// method one public call), then the deprecation log around the version 1 names (cp75).
import { addFeatures } from "./features.mjs";
import { addNames } from "./namedefs.mjs";
import { addHiding } from "./hiding.mjs";
import { addFindReplace } from "./findreplace.mjs";
import { addFill } from "./fill.mjs";
import { addV2 } from "./api2.mjs";
import { addV3, addDeprecations, SHEET_OLD } from "./api3.mjs";
import { addEvents } from "./events.mjs";

export function extendSheet(sheet, core) {
  let s = sheet;
  for (const add of [addFeatures, addNames, addHiding, addFindReplace, addFill, addV2, addV3, addEvents]) s = add(s, core);
  return addDeprecations(s, SHEET_OLD);
}
