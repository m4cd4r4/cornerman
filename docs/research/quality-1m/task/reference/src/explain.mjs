// explain.mjs: a cell and the cells it reads, as a tree (cp39). Each cell is expanded once, at
// its first place in a depth-first pre-order walk; later repeats get from: null. The walk uses
// its own stack, so a 10,000-cell chain does not overflow the JS stack.
import { split } from "./engine.mjs";

export function explainTree(engine, rootId, k) {
  const seen = new Set();
  const top = [];
  const todo = [[`${rootId}|${k}`, top]];
  while (todo.length) {
    const [gk, into] = todo.pop();
    const [id, a] = split(gk);
    const core = engine.coreOf(id);
    const node = { address: engine.label([id, a], rootId), input: core.input(a), value: core.valueOf(a), from: null };
    into.push(node);
    if (seen.has(gk)) continue;
    seen.add(gk);
    node.from = [];
    const kids = engine.ordered(engine.precs(gk), id);
    for (let i = kids.length - 1; i >= 0; i--) todo.push([`${kids[i][0]}|${kids[i][1]}`, node.from]);
  }
  return top[0];
}
