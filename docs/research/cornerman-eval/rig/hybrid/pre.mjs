// Hybrid arm, PreCompact (manual and auto): stdout is appended to the summariser's instructions
// (spike, 2026-11-18). Asks for one tagged list that post.mjs can file without a model. Each tag is
// a plant class of STRESS-TEST-DESIGN.md that a summary is expected to lose: B rule inside a long
// message, C a yes to an option, D a tool-result fact, E the agent's decision, F work in flight,
// and the open-question type of Test 1.
import { SECTION, input, trace } from "./lib.mjs";

const inp = input();
trace("precompact", { session: inp.session_id, trigger: inp.trigger ?? null });
process.stdout.write(`Extra instructions for this summary, from the project's compaction hook.

End the summary with a section headed exactly "## ${SECTION}". It is a flat list, one line per item, each line starting with one of these tags:

- [rule] Every standing rule, constraint or preference the user gave, in the user's own words, including one given in the middle of a longer task message. Where a later message changed a rule, list the current rule only and say what it replaced.
- [choice] Every choice the user made by answering options you described ("the second one", "yes, do that"). Write out what was chosen, not its position in the list.
- [fact] Every value that came from a command or tool result and that later work depends on (a port, an id, a path, a count, a version), with where it came from. Include it even if its source may no longer exist.
- [decision] Every decision you made and its reason, including each approach tried and rejected, and why it was rejected.
- [in flight] Multi-step work under way: the steps done, the step in progress, the steps left, and what is not yet committed.
- [ask first] Everything the user said to ask about or confirm before doing.

Copy every item of an earlier "${SECTION}" section, and of any "cornerman hybrid" note in the conversation, unless the user has since withdrawn it or it is finished work. Never leave an item out for length: shorten other sections instead.
`);
