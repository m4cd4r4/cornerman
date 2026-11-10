// events.mjs: change events (cp65) and the calls in progress (cp75). sheet.onChange(listener), and the wrapper around every public
// sheet and workbook method that delivers one event per changed sheet when the outermost call ends.
import { makeError } from "./errors.mjs";
import { compareAddresses } from "./address.mjs";

let depth = 0; // public calls in progress, on any sheet or workbook
const frames = []; // cp75: the names of those calls, outermost first
const pending = new Set(); // sheets with inputs touched since the outermost call began
const queue = []; // [listeners, cells] waiting to be delivered, oldest first
let delivering = false;

// Every touched sheet whose inputs differ from the start of the call gets one event, queued in
// the order the sheets were first touched; listeners are the ones registered at this moment.
function flush() {
  for (const s of pending) {
    const cells = [...s.before].filter(([k, v]) => (s.core.input(k) ?? "") !== v).map(([k]) => k).sort(compareAddresses);
    s.before.clear();
    if (cells.length && s.listeners.length) queue.push([s.listeners.map((e) => e.f), cells]);
  }
  pending.clear();
  if (delivering) return; // a listener's own call: delivered after the current event
  delivering = true;
  try {
    while (queue.length) {
      const [fs, cells] = queue.shift();
      for (const f of fs) {
        try {
          f({ cells: [...cells] });
        } catch {
          // A listener that throws changes nothing: the change stays and the others still run.
        }
      }
    }
  } finally {
    delivering = false;
  }
}

export function inCall(fn, name = "") {
  depth++;
  frames.push(name);
  try {
    return fn();
  } finally {
    frames.pop();
    if (--depth === 0) flush();
  }
}

// cp75: true when a call starting now is one you made: no public call is in progress, other than
// book.batch (whose fn is your code). A change listener runs when no call is in progress.
export const userCalling = () => frames.every((f) => f === "batch");

// Wrap every method of obj so that it counts as one public call.
export function wrapCalls(obj) {
  for (const [k, f] of Object.entries(obj)) if (typeof f === "function") obj[k] = (...args) => inCall(() => f(...args), k);
  return obj;
}

export function addEvents(sheet, core) {
  const s = { core, before: new Map(), listeners: [] };
  core.touch = (k, input) => {
    if (!s.before.has(k)) s.before.set(k, input);
    pending.add(s);
  };
  // Returns off(): true the first time it removes this listener, false after.
  sheet.onChange = (listener) => {
    if (typeof listener !== "function") throw makeError("#ARG", String(listener), "onChange takes a function");
    const entry = { f: listener };
    s.listeners.push(entry);
    return () => {
      const i = s.listeners.indexOf(entry);
      if (i < 0) return false;
      s.listeners.splice(i, 1);
      return true;
    };
  };
  return wrapCalls(sheet);
}
