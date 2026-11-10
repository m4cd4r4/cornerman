// index.mjs: the public API (cp01-cp35, cp70, cp80). The sheet lives in sheet.mjs, the workbook in workbook.mjs.
export { createSheet, loadSheet } from "./sheet.mjs";
export { createWorkbook } from "./workbook.mjs";
export { loadWorkbook } from "./bookio.mjs";
export { diffWorkbooks } from "./diff.mjs"; // cp70
export { apiIndex } from "./apiindex.mjs"; // cp80
