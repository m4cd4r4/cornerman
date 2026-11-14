# Facts ledger

One line per claim: `F12 | page: "<sentence as the page shows it>" | source: "<verbatim source text>" | file:line`.
A line may carry several `source: "..." | file:line` pairs. Source quotes are verbatim substrings of the cited file
(whitespace-normalised). In a page quote, `{name}` stands for a `data-stat` or `data-run` slot whose value a script
writes. F90 to F97 are written by buildstats.mjs.

## Measured by hand (copied from TASK.md as-is)

- Stock Claude Code starts at 21,200 tokens before your first message: Claude Code 2.1.289, Opus 5.5, empty CLAUDE_CONFIG_DIR, cwd with no CLAUDE.md, .claude or .mcp.json above it, 0 MCP servers, 27 tools. One headless "say hi" run; cache_creation_input_tokens 21,200 + input_tokens 2, read from the first assistant message. (measured 2026-10-04)
- Caveat for anyone repeating it: a cwd under your home folder picks up ~/.claude and ~/.mcp.json as project config (the same probe from such a cwd read 58,978).
- The author's sessions start at 77k to 99k (rules, skills, MCP).
- On the API, cache reads are billed at a tenth of the input price (Anthropic prompt caching pricing).

## index.html: hero and install commands

F1 | page: "claude plugin marketplace add https://github.com/m4cd4r4/cornerman" | source: "claude plugin marketplace add https://github.com/m4cd4r4/cornerman" | README.md:18
F2 | page: "claude plugin install cornerman@cornerman --config relay=10" | source: "claude plugin install cornerman@cornerman" | README.md:19 | source: "for example `--config relay=10`" | docs/HOW-IT-WORKS.md:225
F3 | page: "claude plugin install cornerman@cornerman" | source: "claude plugin install cornerman@cornerman" | README.md:19
F4 | page: "A free, open-source Claude Code plugin." | source: "A free, open-source plugin for Claude Code" | docs/media/src/cards.html:117
F5 | page: "Relay on, in your terminal:" | source: "Plugin (in your terminal):" | README.md:15 | source: "claude plugin install cornerman@cornerman" | README.md:19 | source: "for example `--config relay=10`" | docs/HOW-IT-WORKS.md:225

## Build stats (written by site/buildstats.mjs; `value:` is the figure it wrote)

<!-- buildstats:begin -->
F90 | page: "{sessions} sessions" | source: "const sessions = out.length;" | site/buildstats.mjs:127 | value: 15 (sessions in the run chain, buildstats.mjs)
F91 | page: "{clears} automatic clears" | source: "const clears = sessions - 1;" | site/buildstats.mjs:128 | value: 14 (sessions after the first, each begun by a /clear, buildstats.mjs)
F92 | page: "{commits} site: commits" | source: "const commits = lines.length;" | site/buildstats.mjs:147 | value: 42 (site: commits since site-v5-base, buildstats.mjs)
F93 | page: "{minutes} minutes" | source: "const minutes = (Math.round((last - t0) / 6000) / 10).toFixed(1);" | site/buildstats.mjs:129 | value: 94.1 (run start to the RELAY-SITE-DONE reply, buildstats.mjs)
F94 | page: "{tokens} tokens sent" | source: "const tokensSent = (Math.round(tokens / 1e5) / 10).toFixed(1) + "M";" | site/buildstats.mjs:130 | value: 91.0M (context summed over every reply, buildstats.mjs)
F95 | page: "{first}" | source: "first: commits ? awst(lines[commits - 1]) : "n/a"" | site/buildstats.mjs:148 | value: 07:36 (oldest site: commit, AWST, buildstats.mjs)
F96 | page: "{last}" | source: "last: commits ? awst(lines[0]) : "n/a"" | site/buildstats.mjs:148 | value: 09:05 (newest site: commit, AWST, buildstats.mjs)
F97 | page: "{date}" | source: "date: commits ? awstDate(lines[0]) : "n/a"" | site/buildstats.mjs:149 | value: 5 Oct 2026 (AWST date of the newest site: commit, buildstats.mjs)
<!-- buildstats:end -->

## index.html: what it does (the README's example output)

F10 | page: "Claude writes a short note, called a handover: the goal, the next action, where things stand, the decisions made and what already failed." | source: "A handover is a short note about the work: the goal, the next action, where things stand, the decisions made and what already failed." | plugin/README.md:5
F11 | page: "Saved handover "Cart totals rounding" (id 31c9af7)." | source: "Saved handover "Cart totals rounding" (id 31c9af7)." | docs/HOW-IT-WORKS.md:40
F12 | page: "After /clear, the next session in ~/code/widget-shop loads it automatically." | source: "After /clear, the next session in ~/code/widget-shop loads it automatically." | docs/HOW-IT-WORKS.md:41
F14 | page: "cornerman: loaded handover "Cart totals rounding" (saved just now)." | source: "cornerman: loaded handover "Cart totals rounding" (saved just now)." | docs/HOW-IT-WORKS.md:47
F15 | page: "A copy to read or share: ~/.cornerman/loaded/widget-shop-cart-totals-rounding-31c9af7.md" | source: "A copy to read or share: ~/.cornerman/loaded/widget-shop-cart-totals-rounding-31c9af7.md" | docs/HOW-IT-WORKS.md:48
F16 | page: "# the example in How it works, in a widget-shop repo" | source: "Window 1, on widget-shop" | docs/HOW-IT-WORKS.md:102
F17 | page: "# Claude carries on from the handover." | source: "The fresh chat loads the handover and carries on." | plugin/README.md:15
F19 | page: "/cornerman:handover" | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17
F6 | page: "/clear" | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17
F7 | page: "go" | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17
F18 | page: "Three steps: save a handover, /clear, carry on." | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17 | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17 | source: "The fresh chat loads the handover and carries on." | plugin/README.md:15

## index.html: fallback feed in the media box (with the relay on)

F62 | page: "# with the relay on, context passes the nudge size" | source: "past a size you choose, Claude is asked to save a handover." | README.md:122
F63 | page: "cornerman: context is about 182k tokens (nudge at 180k)." | source: "cornerman: context is about 182k tokens (nudge at 180k)." | docs/HOW-IT-WORKS.md:263
F64 | page: "# Claude is asked to save a handover" | source: "Claude is asked to save a handover" | README.md:122
F65 | page: "# the plugin runs /clear when the turn ends" | source: "cornerman runs `/clear` when the turn ends" | docs/HOW-IT-WORKS.md:273
F60 | page: "Replay of the run that built this page." | source: "Caption under the box: "Replay of the run that built this page."" | TASK.md: Media box

## index.html: the relay

F20 | page: "Past a size you choose, Claude saves a handover and the plugin runs /clear when the turn ends." | source: "past a size you choose, Claude is asked to save a handover." | README.md:122 | source: "After Claude saves a handover, cornerman runs `/clear` when the turn ends" | docs/HOW-IT-WORKS.md:272
F21 | page: "On by default. Needs Claude Code 2.1.275 or later; works in a terminal and in the VS Code chat panel." | source: "They belong to the nudge, the relay and the idle handover, which are all on by default." | docs/HOW-IT-WORKS.md:233 | source: "It needs Claude Code 2.1.275 or later; an older build ignores it" | docs/HOW-IT-WORKS.md:279 | source: "It works in a terminal and in the VS Code chat panel." | docs/HOW-IT-WORKS.md:280
F23 | page: "plugin default, 180k (this run's setting is not recorded)" | source: "The default nudge size is now 250k tokens (was 180k)." | CHANGELOG.md:136
F25 | page: "{sessions} sessions. Peaks: {peakLo} to {peakHi} tokens." | source: "var vals = { sessions: String(run.sessions.length), peakLo: kTok(Math.min.apply(null, peaks)), peakHi: kTok(Math.max.apply(null, peaks)) };" | site/app.js:185
F26 | page: "nudge at {nudge} (this run's setting)" | source: "const m = nudgeText.match(/threshold (\d+)k/);" | site/buildstats.mjs:113
F27 | page: "Source: this site's build transcripts (buildstats.mjs)" | source: "buildstats.mjs: reads a relay run's transcripts and writes its figures into the site." | site/buildstats.mjs:1
F28 | page: "Source: transcripts of an earlier relay run (site/source/fixture), buildstats.mjs" | source: "site/source/fixture holds the transcripts of an earlier relay run." | site/buildstats.mjs:5
F29 | page: "Sample data from an earlier run. Replaced after this build." | source: "Sample data from an earlier run:" | site/buildstats.mjs:5 | source: "Replaced after this build:" | site/buildstats.mjs:6
F30 | page: "Source: this site's build transcripts and git log (buildstats.mjs)" | source: "buildstats.mjs: reads a relay run's transcripts and writes its figures into the site." | site/buildstats.mjs:1 | source: "const commits = lines.length; // git log site-v5-base..site-v5 --grep" | site/buildstats.mjs:147

## index.html: proof, the 2026-10-03 measurement

F35 | page: "Context per /clear, a separate 2026-10-03 run" | source: "2026-10-03 run: 191" | STATUS.md:53
F36 | page: "191 /clear loads" | source: "2026-10-03 run: 191 real `/clear` loads" | STATUS.md:53
F37 | page: "195k median before" | source: "median context 195k before and 97k after, a median drop of 101k." | STATUS.md:54
F38 | page: "97k median after" | source: "median context 195k before and 97k after, a median drop of 101k." | STATUS.md:54
F39 | page: "101k median drop" | source: "median context 195k before and 97k after, a median drop of 101k." | STATUS.md:54
F40 | page: "Source: STATUS.md. As of 2026-10-05, scripts/measure.mjs is on the open PR #57, not in the released plugin." | source: "**Context-savings measurement** (#57). `scripts/measure.mjs`. 2026-10-03 run" | STATUS.md:53 | source: "Checked against `origin/main` at d2e5342 on 2026-10-05." | STATUS.md:3 | source: "## In flight" | STATUS.md:27 | source: "| `feat/measure-context` | #57 open | keep |" | STATUS.md:82

## index.html: install and FAQ

F42 | page: "Manual, relay and nudge off: /cornerman:handover, /clear, go." | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17 | source: "--config auto_nudge=false" | docs/HOW-IT-WORKS.md:219
F413 | page: "claude plugin install cornerman@cornerman --config auto_nudge=false --config relay=off" | source: "claude plugin install cornerman@cornerman --config auto_nudge=false" | docs/HOW-IT-WORKS.md:219 | source: "The third plugin option, `relay`, is `off`" | docs/HOW-IT-WORKS.md:224
F43 | page: "Optional: VS Code extension; needs the plugin." | source: "## The VS Code sidebar (optional)" | docs/HOW-IT-WORKS.md:443 | source: "It needs that plugin." | extension/README.md:12
F44 | page: "code --install-extension macdara.cornerman" | source: "code --install-extension macdara.cornerman" | README.md:27
F256 | page: "Marketplace, Open VSX, releases." | source: "Install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=macdara.cornerman)" | docs/HOW-IT-WORKS.md:461 | source: "or [Open VSX](https://open-vsx.org/extension/macdara/cornerman):" | docs/HOW-IT-WORKS.md:462 | source: "# Changelog" | CHANGELOG.md:1
F46 | page: "Handovers are plain text files on your disk, in ~/.cornerman. Nothing is sent anywhere unless you turn on sync (to your own private git remote) or web mode (for Claude Code on the web). Keep secrets out of them." | source: "Handovers are plain text files on your disk, in `~/.cornerman`." | plugin/README.md:29 | source: "**Network: nothing by default.**" | plugin/README.md:30 | source: "pushes and pulls the store to a private git remote that you set up" | plugin/README.md:31 | source: "for Claude Code on the web" | plugin/README.md:32 | source: "Keep secrets out of them." | plugin/README.md:29
F47 | page: "Node 18 or later and git. On Windows, Claude Code runs plugin hooks through Git Bash, which comes with Git for Windows." | source: "You need Node 18 or later and git." | README.md:22 | source: "On Windows, Claude Code runs plugin hooks through Git Bash, which comes with Git for Windows." | README.md:22
F48 | page: "The relay needs Claude Code 2.1.275 or later and works in a terminal and in the VS Code chat panel." | source: "It needs Claude Code 2.1.275 or later; an older build ignores it" | docs/HOW-IT-WORKS.md:279 | source: "It works in a terminal and in the VS Code chat panel." | docs/HOW-IT-WORKS.md:280
F49 | page: "When it uses up its clears for that Claude Code window, or when two continued sessions in a row make no new commit (outside a git repo, only the count applies). It says why. When the task is finished, Claude ends without a handover, so there is nothing to continue." | source: "It stops, and says so, at its count, or when two continued sessions in a row make no new commit (outside a git repo, only the count applies)." | docs/HOW-IT-WORKS.md:275 | source: "end without a handover when the task is finished, so there is nothing to continue." | docs/HOW-IT-WORKS.md:277
F45 | page: "It stays out of the way for a subagent's save, a failed save, an interrupted turn and headless runs." | source: "It stays out of the way for a subagent's save, a failed save, an interrupted turn and headless runs" | CHANGELOG.md:237

## Nudge default and settings

F24 | page: "The nudge is on by default. Past 250k tokens of context (the default; Nudge at changes it), the plugin asks Claude to save a handover." | source: "With the nudge on (the default;" | docs/HOW-IT-WORKS.md:243 | source: "when the chat's context passes **Nudge at** (250k tokens by default), Claude is asked to save a handover" | plugin/README.md:21

## Comparison (README.md:115 to 122)

F101 | page: "Its own summary of the chat" | source: "| `/compact` | Its own summary of the chat | What the summary leaves out | Smaller |" | docs/HOW-IT-WORKS.md:57
F102 | page: "What the summary leaves out" | source: "| `/compact` | Its own summary of the chat | What the summary leaves out | Smaller |" | docs/HOW-IT-WORKS.md:57
F103 | page: "The whole chat" | source: "| `--resume` | The whole chat | Nothing | Same as before |" | docs/HOW-IT-WORKS.md:58
F104 | page: "Nothing" | source: "| `--resume` | The whole chat | Nothing | Same as before |" | docs/HOW-IT-WORKS.md:58
F105 | page: "Everything, including where you were" | source: "| `/clear` | Nothing | Everything, including where you were | Empty |" | docs/HOW-IT-WORKS.md:59
F106 | page: "A short handover it wrote on purpose" | source: "| **cornerman** | **A short handover it wrote on purpose** | **The rest of the chat** | **Just the handover** |" | docs/HOW-IT-WORKS.md:60

## how-it-works.html: the handover

F110 | page: "Claude reads your branch, your changes and your last few commits." | source: "Claude reads your branch, your changes and your last few commits" | plugin/README.md:13
F111 | page: "Each loaded handover is also saved as markdown in ~/.cornerman/loaded/ for 30 days." | source: "Each loaded handover is also copied to `~/.cornerman/loaded/` for 30 days." | plugin/README.md:29
F112 | page: "The plugin checks for a waiting handover when a session starts, after /clear and after compaction (when /compact, or Claude Code on its own, shrinks the chat). When nothing is waiting, it prints nothing." | source: "The plugin checks for a waiting handover when a session starts, after `/clear` and after compaction (when `/compact`, or Claude Code on its own, shrinks the chat). When nothing is waiting, it prints nothing." | docs/HOW-IT-WORKS.md:105
F113 | page: "Known limitation: the loop runs on /clear. A session started with --resume or /resume loads nothing." | source: "### Known limitations" | CHANGELOG.md:324 | source: "The loop runs on `/clear`. A session started with `--resume` or `/resume` loads nothing." | CHANGELOG.md:329
F114 | page: "Each handover belongs to the Claude Code window that wrote it. While that window is open, it is the only one that loads the handover after /clear." | source: "**Each handover belongs to the Claude Code window that wrote it.** While that window is open, it is the only one that loads the handover after `/clear`." | docs/HOW-IT-WORKS.md:107
F115 | page: "Other windows on the same project list it when they start, and load it only if you ask." | source: "Other windows on the same project list it when they start, and load it only if you ask." | docs/HOW-IT-WORKS.md:107
F116 | page: "Once that window closes, a session on the same branch loads it, if it is 7 days old or less." | source: "Once that window closes, a session on the same branch loads it." | docs/HOW-IT-WORKS.md:107 | source: "from a closed window,<br>on your branch,<br>7 days old or less" | docs/HOW-IT-WORKS.md:114
F117 | page: "If it is the only one waiting from a closed window, it loads on any branch, if it is 7 days old or less." | source: "the only one waiting,<br>from a closed window,<br>any branch, 7 days old or less" | docs/HOW-IT-WORKS.md:115
F118 | page: "A handover older than 7 days is listed, not loaded." | source: "A handover older than 7 days is listed, not loaded." | docs/HOW-IT-WORKS.md:107
F119 | page: "After compaction, only this window's own handover loads." | source: "After compaction, only this window's own handover loads." | docs/HOW-IT-WORKS.md:122
F120 | page: "A handover loads in the checkout it was saved in." | source: "A handover loads in the checkout it was saved in;" | CHANGELOG.md:301
F121 | page: "These are the common cases." | source: "These are the common cases." | docs/HOW-IT-WORKS.md:122
F122 | page: "Where it is kept" | source: "Handovers are plain text files on your disk, in `~/.cornerman`." | plugin/README.md:29
F123 | page: "When it loads" | source: "The plugin checks for a waiting handover when a session starts" | docs/HOW-IT-WORKS.md:105
F124 | page: "What does not load it" | source: "A session started with `--resume` or `/resume` loads nothing." | CHANGELOG.md:329
F125 | page: "Which handover loads" | source: "## Which handover loads" | docs/HOW-IT-WORKS.md:99
F126 | page: "What it holds" | source: "A handover is a short note about the work" | plugin/README.md:5

## how-it-works.html: loop diagram

F130 | page: "work" | source: "The fresh chat loads the handover and carries on." | plugin/README.md:15
F131 | page: "the chat grows" | source: "When a Claude Code chat gets long" | README.md:9
F132 | page: "nudge" | source: "With the nudge on (the default;" | docs/HOW-IT-WORKS.md:243
F133 | page: "with the nudge on" | source: "`auto_nudge` or `CORNERMAN_AUTO` turns it off" | docs/HOW-IT-WORKS.md:243
F134 | page: "asks Claude to save" | source: "when the chat's context passes **Nudge at** (250k tokens by default), Claude is asked to save a handover" | plugin/README.md:21
F135 | page: "save" | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17
F136 | page: "Claude writes a handover" | source: "A handover is a short note about the work" | plugin/README.md:5
F137 | page: "you ask, or the nudge does" | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17 | source: "when the chat's context passes **Nudge at** (250k tokens by default), Claude is asked to save a handover" | plugin/README.md:21
F138 | page: "you type it" | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17
F139 | page: "or the plugin, with the relay on" | source: "cornerman runs `/clear` when the turn ends" | docs/HOW-IT-WORKS.md:273
F140 | page: "load" | source: "The fresh session loads the note after `/clear`." | README.md:121
F141 | page: "the fresh session loads it" | source: "The fresh session loads the note after `/clear`." | README.md:121
F142 | page: "carry on" | source: "The fresh chat loads the handover and carries on." | plugin/README.md:15
F143 | page: "Claude works and the chat grows." | source: "When a Claude Code chat gets long" | README.md:9
F144 | page: "With the nudge on, past the size you set, the plugin asks Claude to save a handover." | source: "past a size you choose, Claude is asked to save a handover." | README.md:122 | source: "when the chat's context passes **Nudge at** (250k tokens by default), Claude is asked to save a handover" | plugin/README.md:21
F145 | page: "Claude saves a handover: you type /cornerman:handover, or the nudge asks." | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17 | source: "Claude is asked to save a handover" | README.md:122
F146 | page: "/clear: you type it, or the plugin runs it when the turn ends, with the relay on." | source: "By hand, with the relay off: `/cornerman:handover`, `/clear`, `go`." | plugin/README.md:17 | source: "cornerman runs `/clear` when the turn ends" | docs/HOW-IT-WORKS.md:273
F147 | page: "The fresh session loads the handover, and Claude carries on." | source: "The fresh session loads the note after `/clear`." | README.md:121 | source: "The fresh chat loads the handover and carries on." | plugin/README.md:15
F148 | page: "The loop" | source: "The loop runs on `/clear`." | CHANGELOG.md:329

## how-it-works.html: worked example (README's example, never called real)

F150 | page: "The example in How it works: a handover in a widget-shop repo, saved, loaded after /clear, and the copy it leaves." | source: "Window 1, on widget-shop" | docs/HOW-IT-WORKS.md:102 | source: "Saved handover \"Cart totals rounding\" (id 31c9af7)." | docs/HOW-IT-WORKS.md:40 | source: "After /clear, the next session in ~/code/widget-shop loads it automatically." | docs/HOW-IT-WORKS.md:41 | source: "A copy to read or share:" | docs/HOW-IT-WORKS.md:48
F151 | page: "The copy in ~/.cornerman/loaded/ stays for 30 days: reread what a session started from, or @-mention it in another session." | source: "Each loaded handover is also copied to `~/.cornerman/loaded/` for 30 days." | plugin/README.md:29 | source: "Open it to reread what the session started from, or @-mention it in another session." | docs/HOW-IT-WORKS.md:93
F152 | page: "~/.cornerman/loaded/widget-shop-cart-totals-rounding-31c9af7.md" | source: "A copy to read or share: ~/.cornerman/loaded/widget-shop-cart-totals-rounding-31c9af7.md" | docs/HOW-IT-WORKS.md:48
F153 | page: "# the copy, as the screenshot of it in How it works reads" | source: "An editor tab titled widget-shop-cart-totals-rounding-31c9af7.md, in ~/.cornerman/loaded. The file reads:" | docs/HOW-IT-WORKS.md:88
F154 | page: "# Cart totals rounding" | source: "The file reads: # Cart totals rounding." | docs/HOW-IT-WORKS.md:88
F155 | page: "Repo: widget-shop. Branch: fix/cart-rounding." | source: "Repo: widget-shop. Branch: fix/cart-rounding." | docs/HOW-IT-WORKS.md:88
F156 | page: "Goal: Cart totals must round to the cent the way the payment provider does, so the checkout total and the receipt always match." | source: "Goal: Cart totals must round to the cent the way the payment provider does, so the checkout total and the receipt always match." | docs/HOW-IT-WORKS.md:88
F157 | page: "Next action: Run npm test -- cart and fix src/cart.js:2 so cartTotal rounds once at the end, half-up, to 2 decimal places." | source: "Next action: Run npm test -- cart and fix src/cart.js:2 so cartTotal rounds once at the end, half-up, to 2 decimal places." | docs/HOW-IT-WORKS.md:88
F159 | page: "Claude keeps" | source: "| | Claude keeps | You lose | Chat size after |" | docs/HOW-IT-WORKS.md:55
F160 | page: "You lose" | source: "| | Claude keeps | You lose | Chat size after |" | docs/HOW-IT-WORKS.md:55
F161 | page: "Chat size after" | source: "| | Claude keeps | You lose | Chat size after |" | docs/HOW-IT-WORKS.md:55
F162 | page: "Smaller" | source: "| `/compact` | Its own summary of the chat | What the summary leaves out | Smaller |" | docs/HOW-IT-WORKS.md:57
F163 | page: "Same as before" | source: "| `--resume` | The whole chat | Nothing | Same as before |" | docs/HOW-IT-WORKS.md:58
F164 | page: "Nothing" | source: "| `/clear` | Nothing | Everything, including where you were | Empty |" | docs/HOW-IT-WORKS.md:59
F165 | page: "Empty" | source: "| `/clear` | Nothing | Everything, including where you were | Empty |" | docs/HOW-IT-WORKS.md:59
F166 | page: "The rest of the chat" | source: "| **cornerman** | **A short handover it wrote on purpose** | **The rest of the chat** | **Just the handover** |" | docs/HOW-IT-WORKS.md:60
F167 | page: "Just the handover" | source: "| **cornerman** | **A short handover it wrote on purpose** | **The rest of the chat** | **Just the handover** |" | docs/HOW-IT-WORKS.md:60
F168 | page: "/compact" | source: "| `/compact` | Its own summary of the chat | What the summary leaves out | Smaller |" | docs/HOW-IT-WORKS.md:57
F169 | page: "--resume" | source: "| `--resume` | The whole chat | Nothing | Same as before |" | docs/HOW-IT-WORKS.md:58
F170 | page: "cornerman" | source: "| **cornerman** | **A short handover it wrote on purpose** | **The rest of the chat** | **Just the handover** |" | docs/HOW-IT-WORKS.md:60
F171 | page: "Compared with /compact, --resume and /clear" | source: "How this compares with `/compact`, `--resume` and `/clear`" | docs/HOW-IT-WORKS.md:53
F172 | page: "Source: the comparison table in How it works." | source: "| | Claude keeps | You lose | Chat size after |" | docs/HOW-IT-WORKS.md:55
F158 | page: "Decisions already made: Round once, at the total, never per line: the payment provider does the same." | source: "Decisions already made: Round once, at the total, never per line: the payment provider does the same." | docs/HOW-IT-WORKS.md:88

## how-it-works.html: the model (slot values written by app.js)

F173 | page: "The model" | source: "cornerman cost model." | site/model.js:1
F174 | page: "A model, not a measurement. Claude rereads the whole context for every reply: set a task and see how much it rereads with cornerman and without it." | source: "A model, not a measurement." | site/model.js:1 | source: "because Claude reads the whole chat again every time" | README.md:7
F175 | page: "Context window" | source: "The author uses a 1M-token context window." | docs/HOW-IT-WORKS.md:249
F176 | page: "1M" | source: "The author uses a 1M-token context window" | docs/HOW-IT-WORKS.md:249
F177 | page: "200k" | source: "On a 200k window" | docs/HOW-IT-WORKS.md:249
F178 | page: "Start size {mStart}" | source: "the size your sessions start at" | docs/HOW-IT-WORKS.md:249 | source: "mStart: tok(start)" | site/app.js:243
F179 | page: "Typical values: see Start size below" | source: "keep it well above the size your sessions start at" | docs/HOW-IT-WORKS.md:249
F180 | page: "Clear at {mClearAt}" | source: "past a size you choose, Claude is asked to save a handover." | README.md:122 | source: "mClearAt: tok(clearAt)" | site/app.js:243
F181 | page: "Task size {mWork}" | source: "mWork: tok(work)" | site/app.js:243 | source: "var add = Math.min(STEP, work - done);" | site/model.js:19
F182 | page: "On a 200k window, the run without cornerman compacts on its own at {mCompact} (assumed)." | source: "On a 200k window, set **Nudge at** below the size where Claude Code compacts on its own" | docs/HOW-IT-WORKS.md:249 | source: "mCompact: tok(M.compactAt(win))" | site/app.js:243
F183 | page: "Reread over the task: {mClearReread} with cornerman, {mBaseReread} without it." | source: "because Claude reads the whole chat again every time" | README.md:7 | source: "vals.mClearReread = tok(r.clear.reread);" | site/app.js:244 | source: "vals.mBaseReread = tok(r.base.reread);" | site/app.js:245
F184 | page: "without it: Claude Code compacts on its own" | source: "the size where Claude Code compacts on its own" | docs/HOW-IT-WORKS.md:249
F185 | page: "Resets" | source: "return { resets: resets, peak: peak, reread: reread" | site/model.js:32
F186 | page: "Peak context" | source: "return { resets: resets, peak: peak, reread: reread" | site/model.js:32
F187 | page: "Context reread" | source: "return { resets: resets, peak: peak, reread: reread" | site/model.js:32 | source: "because Claude reads the whole chat again every time" | README.md:7
F188 | page: "{mClearResets}" | source: "vals.mClearResets = String(r.clear.resets);" | site/app.js:244
F189 | page: "{mClearPeak}" | source: "vals.mClearPeak = tok(r.clear.peak);" | site/app.js:244
F190 | page: "{mClearReread}" | source: "vals.mClearReread = tok(r.clear.reread);" | site/app.js:244
F191 | page: "without it" | source: "the size where Claude Code compacts on its own" | docs/HOW-IT-WORKS.md:249
F192 | page: "{mBaseResets}" | source: "vals.mBaseResets = String(r.base.resets);" | site/app.js:245
F193 | page: "{mBasePeak}" | source: "vals.mBasePeak = tok(r.base.peak);" | site/app.js:245
F194 | page: "{mBaseReread}" | source: "vals.mBaseReread = tok(r.base.reread);" | site/app.js:245
F195 | page: "Source: site/model.js, a model, not a measurement." | source: "A model, not a measurement." | site/model.js:1
F196 | page: "Each reply adds 5000 new tokens to the context: assumed." | source: "var STEP = 5000;" | site/model.js:3
F197 | page: "Claude rereads the whole context for every reply, so the reread figure is the context summed over every reply." | source: "because Claude reads the whole chat again every time" | README.md:7 | source: "reread += ctx;" | site/model.js:27
F198 | page: "After a clear, the run restarts at the start size plus the handover: about 780 tokens in the handover, an estimate. Measured on the author's own 104 /clears, 20 to 28 Sep 2026, medians." | source: "clear: walk(opts.start, opts.work, opts.clearAt, opts.start + HANDOVER)," | site/model.js:37 | source: "About 780 tokens in the handover, an estimate" | docs/RESEARCH.md:41 | source: "Measured on the author's own 104 /clears, 20 to 28 Sep 2026, medians." | docs/RESEARCH.md:41
F199 | page: "Without cornerman, the run compacts at nine tenths of the window and keeps an 8000-token summary: both assumed." | source: "var SUMMARY = 8000;" | site/model.js:5 | source: "var COMPACT_AT = 0.9;" | site/model.js:6
F200 | page: "The model clears at or below the clear-at size. The plugin asks Claude to save once context is past the size you set, and Claude then saves, so in use, peaks pass it." | source: "if (ctx + add > limit) {" | site/model.js:20 | source: "when the chat's context passes **Nudge at** (250k tokens by default), Claude is asked to save a handover" | plugin/README.md:21

## Measured by hand (lines that cite the block above)

F70 | page: "Stock Claude Code starts at 21,200 tokens before your first message." | source: "Stock Claude Code starts at 21,200 tokens before your first message" | FACTS.md: Measured by hand
F71 | page: "Claude Code 2.1.289, Opus 5.5, empty CLAUDE_CONFIG_DIR, cwd with no CLAUDE.md, .claude or .mcp.json above it, 0 MCP servers, 27 tools. One headless "say hi" run; cache_creation_input_tokens 21,200 + input_tokens 2, read from the first assistant message, 2026-10-04." | source: "Claude Code 2.1.289, Opus 5.5, empty CLAUDE_CONFIG_DIR, cwd with no CLAUDE.md, .claude or .mcp.json above it, 0 MCP servers, 27 tools. One headless "say hi" run; cache_creation_input_tokens 21,200 + input_tokens 2, read from the first assistant message. (measured 2026-10-04)" | FACTS.md: Measured by hand
F72 | page: "The author's sessions start at 77k to 99k (rules, skills, MCP)." | source: "The author's sessions start at 77k to 99k (rules, skills, MCP)." | FACTS.md: Measured by hand
F73 | page: "On the API, cache reads are billed at a tenth of the input price." | source: "On the API, cache reads are billed at a tenth of the input price (Anthropic prompt caching pricing)." | FACTS.md: Measured by hand

## how-it-works.html: start size (each row has its own source line)

F201 | page: "Start size" | source: "Stock Claude Code starts at 21,200 tokens before your first message" | FACTS.md: Measured by hand (copied from TASK.md as-is)
F202 | page: "21,200" | source: "Stock Claude Code starts at 21,200 tokens before your first message" | FACTS.md: Measured by hand (copied from TASK.md as-is)
F203 | page: "Source: one headless run, measured 2026-10-04." | source: "One headless "say hi" run" | FACTS.md: Measured by hand (copied from TASK.md as-is) | source: "(measured 2026-10-04)" | FACTS.md: Measured by hand (copied from TASK.md as-is)
F204 | page: "77k to 99k" | source: "The author's sessions start at 77k to 99k (rules, skills, MCP)." | FACTS.md: Measured by hand (copied from TASK.md as-is)
F205 | page: "Source: the author's own sessions." | source: "The author's sessions start at 77k to 99k (rules, skills, MCP)." | FACTS.md: Measured by hand (copied from TASK.md as-is)

## how-it-works.html: settings (option names only as the sources write them)

F206 | page: "Settings" | source: "seven options that are not set yet" | docs/HOW-IT-WORKS.md:233
F207 | page: "After install, Claude Code says, or asks about, seven options that are not set yet. They belong to the nudge, the relay and the idle handover, which are all on by default." | source: "Claude Code says, or asks about, seven options that are not set yet. They belong to the nudge, the relay and the idle handover, which are all on by default." | docs/HOW-IT-WORKS.md:233
F208 | page: "Nudge to save a handover" | source: "Nudge to save a handover" | plugin/.claude-plugin/plugin.json:17
F209 | page: "Default: on" | source: "With the nudge on (the default;" | docs/HOW-IT-WORKS.md:243
F210 | page: "Turns the nudge on. Past the Nudge at size, the plugin asks Claude to save a handover, and prints a status line saying so." | source: "Nudge to save a handover" | plugin/.claude-plugin/plugin.json:17 | source: "`auto_nudge` or `CORNERMAN_AUTO` turns it off" | docs/HOW-IT-WORKS.md:243 | source: "when the chat's context passes **Nudge at** (250k tokens by default), Claude is asked to save a handover" | plugin/README.md:21 | source: "You see one status line" | docs/HOW-IT-WORKS.md:263
F211 | page: "Source: How it works." | source: "With the nudge on (the default;" | docs/HOW-IT-WORKS.md:243
F212 | page: "Nudge at" | source: "(the default; change it with **Nudge at**" | plugin/README.md:11
F213 | page: "Default: 250k tokens" | source: "When a chat passes 250k tokens (the default;" | plugin/README.md:11
F214 | page: "The context size the nudge waits for. Claude Code keeps it between 50000 and 1000000 tokens." | source: "When a chat passes 250k tokens (the default; change it with **Nudge at**" | plugin/README.md:11 | source: "Claude Code keeps the Nudge at setting between 50000 and 1000000 tokens." | CHANGELOG.md:259
F215 | page: "Source: How it works (default), the CHANGELOG (range)." | source: "Context size, in tokens, that triggers the nudge." | docs/HOW-IT-WORKS.md:208 | source: "Claude Code keeps the Nudge at setting between 50000 and 1000000 tokens." | CHANGELOG.md:259
F216 | page: "relay" | source: "Set the `relay` option" | CHANGELOG.md:233
F217 | page: "Default: 3 clears" | source: "`relay` is a number of clears per Claude Code window (3 by default)" | docs/HOW-IT-WORKS.md:269
F218 | page: "A number of clears per Claude Code window, or unlimited. After Claude saves a handover, cornerman runs /clear when the turn ends and submits the prompt that continues from it. Needs Claude Code 2.1.275 or later; an older build ignores it." | source: "to a number of clears per Claude Code window, or `unlimited`. After Claude saves a handover, clear-resume runs `/clear` when the turn ends and submits the prompt that continues from it." | CHANGELOG.md:236 | source: "Needs Claude Code 2.1.275 or later; an older build ignores it" | CHANGELOG.md:238
F219 | page: "Source: the CHANGELOG." | source: "Set the `relay` option (in `/config` or `/plugin configure`)" | CHANGELOG.md:234
F220 | page: "Set them with /plugin configure cornerman@cornerman, or in /config: the nudge settings need Claude Code 2.1.269 or later there. In the Claude Code panel in VS Code, set them from a terminal with claude plugin install cornerman@cornerman --config." | source: "Turn it on and set its size with `/plugin configure clear-resume@clear-resume`, or in `/config` in Claude Code 2.1.269 or later." | CHANGELOG.md:258 | source: "In the Claude Code panel in VS Code, set them from a terminal with `claude plugin install clear-resume@clear-resume --config`." | CHANGELOG.md:260 | source: "Set the `relay` option (in `/config` or `/plugin configure`)" | CHANGELOG.md:234
F221 | page: "The environment variables still work: CORNERMAN_AUTO wins whenever it is set, and CORNERMAN_NUDGE_AT wins when it is a positive number." | source: "The environment variables still work: `CLEAR_RESUME_AUTO` wins whenever it is set, and `CLEAR_RESUME_NUDGE_AT` wins when it is a positive number." | CHANGELOG.md:262
F222 | page: "Opt-in: sync (to your own private git remote) and web mode (for Claude Code on the web)." | source: "Two opt-in modes use git and nothing else:" | plugin/README.md:30 | source: "pushes and pulls the store to a private git remote that you set up" | plugin/README.md:31 | source: "for Claude Code on the web" | plugin/README.md:32
F223 | page: "Source: the plugin README." | source: "No telemetry, no analytics, no web requests." | plugin/README.md:30

## changelog.html: releases

F224 | page: "Releases" | source: "# Changelog" | CHANGELOG.md:1
F225 | page: "Each release in CHANGELOG.md, newest first." | source: "# Changelog" | CHANGELOG.md:1 | source: "## 0.4.0" | CHANGELOG.md:186
F226 | page: "0.3.2" | source: "## 0.3.2" | CHANGELOG.md:219
F227 | page: "The relay stops when work stalls: it stops after two continued sessions in a row make no new commit, and says so." | source: "The relay stops when work stalls." | CHANGELOG.md:223 | source: "it stops after two continued sessions in a row make no new commit, and says so" | CHANGELOG.md:224
F228 | page: "Outside a git repo only the budget applies." | source: "Outside a git repo only the budget applies." | CHANGELOG.md:225
F229 | page: "With the relay on, the context nudge tells Claude to end without a handover when the task is finished." | source: "With the relay on, the context nudge tells Claude to end without a handover when the task is finished" | CHANGELOG.md:227
F230 | page: "0.3.1" | source: "## 0.3.1" | CHANGELOG.md:229
F231 | page: "The relay: clear and continue with no keypress." | source: "The relay: clear and continue with no keypress." | CHANGELOG.md:233
F232 | page: "After Claude saves a handover, cornerman runs /clear when the turn ends and submits the prompt that continues from it." | source: "After Claude saves a handover, clear-resume runs `/clear` when the turn ends and submits the prompt that continues from it." | CHANGELOG.md:236
F233 | page: "Off by default. Needs Claude Code 2.1.275 or later; an older build ignores it." | source: "Off by default. Needs Claude Code 2.1.275 or later; an older build ignores it" | CHANGELOG.md:238
F234 | page: "0.3.0" | source: "## 0.3.0" | CHANGELOG.md:240
F235 | page: "Headless runs continue themselves: node plugin/scripts/run.mjs runs claude -p in segments." | source: "Headless runs continue themselves." | CHANGELOG.md:244 | source: "`node plugin/scripts/run.mjs` runs `claude -p` in segments." | CHANGELOG.md:245
F236 | page: "It needs caps (--max-segments, --total-budget-usd, and the command's own --max-turns and --max-budget-usd)." | source: "It needs caps (`--max-segments`, `--total-budget-usd`, and the command's own `--max-turns` and `--max-budget-usd`)" | CHANGELOG.md:248
F237 | page: "It stops the chain when two continued segments in a row make no new commit." | source: "stops the chain when two continued segments in a row make no new commit" | CHANGELOG.md:249
F238 | page: "0.2.1" | source: "## 0.2.1" | CHANGELOG.md:253
F239 | page: "The nudge has settings in Claude Code." | source: "The nudge has settings in Claude Code." | CHANGELOG.md:257
F240 | page: "Turn it on and set its size with /plugin configure cornerman@cornerman, or in /config in Claude Code 2.1.269 or later." | source: "Turn it on and set its size with `/plugin configure clear-resume@clear-resume`, or in `/config` in Claude Code 2.1.269 or later." | CHANGELOG.md:258
F241 | page: "0.2.0" | source: "## 0.2.0" | CHANGELOG.md:264
F242 | page: "Write one short handover on purpose, /clear, and that window's fresh session picks it up." | source: "Write one short handover on purpose, `/clear`, and that window's fresh session picks it up." | CHANGELOG.md:266
F243 | page: "Other open windows on the same project only list it." | source: "Other open windows on the same project only list it" | CHANGELOG.md:267
F244 | page: "Known limitation: the loop runs on /clear. A session started with --resume or /resume loads nothing." | source: "### Known limitations" | CHANGELOG.md:324 | source: "The loop runs on `/clear`. A session started with `--resume` or `/resume` loads nothing." | CHANGELOG.md:329

## changelog.html: build log (rows written by site/buildlog.mjs from git log)

F245 | page: "{sha} {when} {subject}" | source: "const out = execFileSync(\"git\", [\"log\", \"site-v5-base..site-v5\", \"--grep\", \"^site:\", \"--reverse\", \"--format=%h%x09%cI%x09%s\"]," | site/buildlog.mjs:23
F246 | page: "Build log" | source: "buildlog.mjs: writes the build log on changelog.html from git" | site/buildlog.mjs:1
F247 | page: "Each site: commit since site-v5-base, oldest first: short sha, AWST time and subject." | source: "Rows: every site: commit since site-v5-base, oldest first, as short sha, AWST time and subject." | site/buildlog.mjs:3
F248 | page: "Source: git log, written by buildlog.mjs." | source: "buildlog.mjs: writes the build log on changelog.html from git" | site/buildlog.mjs:1
F249 | page: "The totals will come from buildstats.mjs, run on this build's transcripts after the run, and be committed as stats:." | source: "run on this build's transcripts" | site/buildstats.mjs:6 | source: "After the run, its output is committed as stats:" | site/buildstats.mjs:6
F250 | page: "The totals came from buildstats.mjs, run on this build's transcripts after the run, and were committed as stats:." | source: "run on this build's transcripts" | site/buildstats.mjs:6 | source: "After the run, its output is committed as stats:" | site/buildstats.mjs:6
F251 | page: "0.4.0" | source: "## 0.4.0" | CHANGELOG.md:186
F252 | page: "/relay for one window: it overrides the relay option for the window you type it in and starts its count over." | source: "`/relay` for one window." | CHANGELOG.md:190 | source: "overrides the `relay` option for the window you type it in and starts its count over" | CHANGELOG.md:191
F253 | page: "A countdown of the clears left. The status line shows it while the relay is on." | source: "A countdown of the clears left." | CHANGELOG.md:193 | source: "The status line shows it while the relay is on." | CHANGELOG.md:193
F254 | page: "The relay works from the VS Code chat panel." | source: "The relay works from the VS Code chat panel." | CHANGELOG.md:195
F255 | page: "VS Code extension 0.4.0: a context pie in the status bar, a relay item showing this window's clears used against its budget, and a Worktrees view." | source: "VS Code extension 0.4.0" | CHANGELOG.md:202 | source: "Context pie** in the status bar" | CHANGELOG.md:204 | source: "Relay item** showing this window's clears used against its budget" | CHANGELOG.md:207 | source: "Worktrees view" | CHANGELOG.md:208

## how-it-works.html: what's inside

F257 | page: "What's inside" | source: "## What's inside" | docs/HOW-IT-WORKS.md:568
F258 | page: "Two skills" | source: "two skills, six hooks, one Claude Code mod and a shared" | docs/HOW-IT-WORKS.md:570
F259 | page: "Claude writes the handover and saves it with save.mjs, which reads it on stdin." | source: "Save a handover for the current repo. The body is read from stdin." | plugin/scripts/save.mjs:2
F414 | page: "/cornerman:stats prints this month's relay windows, sessions and relays by repo, and last month's totals. It writes nothing." | source: "`/cornerman:stats` prints this month's relay windows, sessions and relays by repo, and last month's totals." | plugin/README.md:19 | source: "and writes nothing." | plugin/README.md:19
F260 | page: "Six hooks" | source: "Entry point for the six hooks" | plugin/scripts/hook-entry.cjs:1
F261 | page: "SessionStart loads the waiting handover at startup, /clear and compaction, then archives it so it loads once. PostToolUse and Stop check the context size for the nudge and the relay." | source: "`SessionStart` (startup, clear and compact) loads a waiting handover." | plugin/README.md:27 | source: "then archives it so it loads exactly once." | plugin/scripts/session-start.mjs:3 | source: "`PostToolUse` and `Stop` check the context size for the nudge and the relay." | plugin/README.md:27
F262 | page: "Any failure exits 0 with no output: a broken plugin must never block a session." | source: "Any failure exits 0 with no output: a broken plugin must never block a session." | plugin/scripts/session-start.mjs:4
F412 | page: "SessionEnd keeps the tables, lists, links and paths the session left on screen, so a list read just before /clear is not lost." | source: "SessionEnd hook: keeps what the session left on screen" | plugin/scripts/session-end.mjs:2
F263 | page: "One Claude Code mod" | source: "### The relay mod (`hooks/relay.ts`)" | plugin/README.md:34 | source: "two skills, six hooks, one Claude Code mod and a shared" | docs/HOW-IT-WORKS.md:570
F264 | page: "A mod is a function-hooks module that runs inside Claude Code. This one is the relay: after Claude saves a handover, it runs /clear and submits the prompt that continues from it." | source: "A mod is a function-hooks module that runs inside Claude Code. This one runs the relay." | plugin/README.md:36 | source: "`/clear`, once after Claude saves a handover" | plugin/README.md:40 | source: "After the clear, as if you typed it:" | plugin/README.md:41
F265 | page: "By default the one program it starts is git rev-parse HEAD, for the stall guard. It sends nothing anywhere." | source: "One by default: `git rev-parse HEAD` in the current repo" | plugin/README.md:39 | source: "The stall guard compares the commit before and after each continued session" | plugin/README.md:39 | source: "It sends nothing anywhere." | plugin/README.md:45
F266 | page: "One store" | source: "Reader and writer for the unified handover store." | plugin/packages/store/store.mjs:1
F267 | page: "One record schema, shared by the plugin and the VS Code extension. Every reader and writer goes through it, so the files on disk are defined in one place." | source: "ONE schema shared by the plugin" | plugin/packages/store/schema.mjs:1 | source: "and the VS Code extension." | plugin/packages/store/schema.mjs:2 | source: "so every reader and writer goes through here." | plugin/packages/store/schema.mjs:3 | source: "shape is defined in exactly one place." | plugin/packages/store/store.mjs:3
F268 | page: "Sync, when you turn it on, is a git transport on top of it." | source: "Git transport for the handover store." | plugin/packages/store/sync.mjs:1
F269 | page: "An install copies plugin/ and nothing else. It has no package.json, so an install runs no npm." | source: "An install copies `plugin/` and nothing else." | docs/HOW-IT-WORKS.md:682 | source: "`plugin/` has no `package.json`, so an install runs no `npm`," | docs/HOW-IT-WORKS.md:683
F270 | page: "Source: the source files, the plugin README and How it works." | source: "### The relay mod (`hooks/relay.ts`)" | plugin/README.md:34 | source: "## What's inside" | docs/HOW-IT-WORKS.md:568

## Footer

F31 | page: "Built in {sessions} sessions and {clears} automatic clears, {commits} commits, {first} to {last} AWST, {date}. Build log" | source: "run on this build's transcripts" | site/buildstats.mjs:6 | source: "const sessions = out.length;" | site/buildstats.mjs:127 | source: "const clears = sessions - 1;" | site/buildstats.mjs:128 | source: "const commits = lines.length;" | site/buildstats.mjs:147 | source: "const awst = (iso) => {" | site/buildstats.mjs:134 | source: "date: commits ? awstDate(lines[0]) : \"n/a\"" | site/buildstats.mjs:149
F50 | page: "MIT licence. Independent, not made or endorsed by Anthropic." | source: "MIT, see [LICENSE](LICENSE)." | README.md:131 | source: "cornerman is an independent project. It is not made or endorsed by Anthropic." | README.md:131

## Results method (copied from RESULTS.md as-is)

Source: I:/Scratch/_ab/RESULTS.md (the A/B write-up, outside this repo), sections "Planned tests: predictions", "launch log" and "results" (measured 2026-10-11 08:05 AWST), plus the idle-gap sections above them. Figures on the results page are slots filled from site/media/results/results.json (`source: "<value>" | results.json: <path>`), which site/extract-results.mjs builds from the transcripts and site/extract-results.test.mjs pins to the RESULTS.md tables and the raw measure files.

- Sonnet 5.5, the same 390k-token site session (copy in switch/), subscription token, identical args on every call, n=1 per point.
- Idle return, n=3 more of each arm (cold return at +65 min; warm handover at +55 min with identical prompt, then fresh read)
- Caveat: the handover path continues from a note, not from the live context. The cold return keeps the full conversation, so the saving is not like-for-like on quality.
- The CLI priced the 2026-10-10 runs lower per token than the 10-07/10-08 runs: H11 read the same 780,784 cached tokens as the 10-09 H1 and cost US$0.11 against US$0.20 (net of US$13.31)
- Cache writes priced the same (C1-C3 = 10-09 C1). So compare cost only within one day's batch. Which price table is current is unchecked.
- relay 5 of 6 (relay-r4 stopped at item 10); compaction 3 of 3 new, so 5 of 6
- one run ended its turn after item 20 following its second compaction
- same-day 10-10 batch: relay US$9.93, 9.13 (mean 9.53, n=2) vs compaction US$9.67, 8.86, 8.53 (mean 9.02, n=3), 6% apart.
- Means: relay 53.7M US$25.93, compaction 50.4M US$24.22
- Both used fewer tokens than one session that never compacts (Sonnet about 1.6x, Opus 81.5M vs 53.7M, about 1.5x).
- On this 30-item build, the relay and Claude Code's auto-compaction at ~177k finished the same share of runs (Sonnet 5 of 6 each, Opus 3 of 3 each) at about the same tokens and cost.
- Planned tests: predictions written BEFORE the runs (drafted 2026-10-10 14:55 AWST, for Macdara's review)
- P3 started 15:16 AWST
- Cache hits and refreshes on Claude Opus 5.5 and Claude Sonnet 5.5 are priced at 0.05x the base input price.
- priced at the 2026-10-11 list (Sonnet 5.5: 2 / 4 (1h write) / 0.10 read / 10; Opus 5.5: 4 / 8 / 0.20 / 20). Check: all 15 runs on CLI 2.1.296 re-cost within US$0.02 of the CLI's own cost
- | Sonnet 5.5 | mean 9.08, median 8.94 (n=5) | mean 9.19, median 8.87 (n=5) | mean 9.66, median 10.27 (n=3) |
- The long session used 1.6x the relay's tokens but cost about 6% more on average, because most of those extra tokens are cache reads at US$0.10/MTok.
- Figures are API-equivalent; the runs used a subscription token.

## index.html: results (slots from results.json)

F400 | page: "Back in a {idle.contextTokens}k session after an idle gap: US${idle.latest.coldMedianUsd} cold, US${idle.latest.warmMedianUsd} with a handover (n={idle.latest.n})." | source: "Idle return, n=3 more of each arm (cold return at +65 min; warm handover at +55 min with identical prompt, then fresh read)" | FACTS.md: Results method | source: "390352" | results.json: idle.contextTokens | source: "1.56" | results.json: idle.latest.coldMedianUsd | source: "0.15" | results.json: idle.latest.warmMedianUsd | source: "3" | results.json: idle.latest.n
F401 | page: "A handover continues from a note, so quality can differ." | source: "the saving is not like-for-like on quality" | FACTS.md: Results method
F402 | page: "A {meta.planItems}-item build: relay finished {groups.relay.finished} of {groups.relay.n} runs, auto-compaction {groups.autocompact.finished} of {groups.autocompact.n}." | source: "relay 5 of 6 (relay-r4 stopped at item 10); compaction 3 of 3 new, so 5 of 6" | FACTS.md: Results method | source: "30" | results.json: meta.planItems | source: "5" | results.json: groups.relay.finished | source: "6" | results.json: groups.relay.n | source: "5" | results.json: groups.autocompact.finished | source: "6" | results.json: groups.autocompact.n
F404 | page: "A session that never compacts used, on average, {groups.relay.vsLong}x the relay's tokens and {groups.autocompact.vsLong}x auto-compaction's (n={groups.long.n} against n={groups.relay.finished})." | source: "one session that never compacts (Sonnet about 1.6x" | FACTS.md: Results method | source: "1.6" | results.json: groups.relay.vsLong | source: "1.7" | results.json: groups.autocompact.vsLong | source: "3" | results.json: groups.long.n | source: "5" | results.json: groups.relay.finished
F405 | page: "Mostly cache reads, 0.05x the input price: at list price it cost {listCost.sonnet.longOverRelayPct}% more." | source: "priced at 0.05x the base input price" | FACTS.md: Results method | source: "used 1.6x the relay's tokens but cost about 6% more on average, because most of those extra tokens are cache reads" | FACTS.md: Results method | source: "6" | results.json: listCost.sonnet.longOverRelayPct
F406 | page: "List-price mean, finished Sonnet runs: US${listCost.sonnet.relay.meanUsd} relay (n={listCost.sonnet.relay.finished}), US${listCost.sonnet.autocompact.meanUsd} auto-compaction (n={listCost.sonnet.autocompact.finished}), US${listCost.sonnet.long.meanUsd} never compacting (n={listCost.sonnet.long.finished})." | source: "priced at the 2026-10-11 list" | FACTS.md: Results method | source: "mean 9.08, median 8.94 (n=5)" | FACTS.md: Results method | source: "mean 9.19, median 8.87 (n=5)" | FACTS.md: Results method | source: "mean 9.66, median 10.27 (n=3)" | FACTS.md: Results method | source: "one session that never compacts" | FACTS.md: Results method | source: "9.08" | results.json: listCost.sonnet.relay.meanUsd | source: "5" | results.json: listCost.sonnet.relay.finished | source: "9.19" | results.json: listCost.sonnet.autocompact.meanUsd | source: "5" | results.json: listCost.sonnet.autocompact.finished | source: "9.66" | results.json: listCost.sonnet.long.meanUsd | source: "3" | results.json: listCost.sonnet.long.finished
F407 | page: "API-equivalent; runs used a subscription." | source: "Figures are API-equivalent; the runs used a subscription token." | FACTS.md: Results method
F408 | page: "Predicted before the runs: {predictions.inside} of {predictions.total} results inside the range, {predictions.outside} outside." | source: "predictions written BEFORE the runs" | FACTS.md: Results method | source: "5" | results.json: predictions.inside | source: "8" | results.json: predictions.total | source: "3" | results.json: predictions.outside
F409 | page: "Written {predictions.writtenTime} AWST on {predictions.dateLabel}, before the first test." | source: "drafted 2026-10-10 14:55 AWST" | FACTS.md: Results method | source: "P3 started 15:16 AWST" | FACTS.md: Results method | source: "14:55" | results.json: predictions.writtenTime | source: "10 Oct" | results.json: predictions.dateLabel
F410 | page: "Idle test: cold return after {idle.latest.idleMin} minutes idle; handover written at {idle.latest.warmAtMin} minutes, then read by a fresh session. Sonnet 5.5. Compare cost within one date: cache reads were priced lower on {idle.latest.dateLabel} than {idle.earlier.dateLabel}." | source: "cold return at +65 min; warm handover at +55 min with identical prompt, then fresh read" | FACTS.md: Results method | source: "Sonnet 5.5, the same 390k-token site session" | FACTS.md: Results method | source: "65" | results.json: idle.latest.idleMin | source: "55" | results.json: idle.latest.warmAtMin | source: "The CLI priced the 2026-10-10 runs lower per token than the 10-07/10-08 runs: H11 read the same 780,784 cached tokens as the 10-09 H1" | FACTS.md: Results method | source: "10 Oct" | results.json: idle.latest.dateLabel | source: "9 Oct" | results.json: idle.earlier.dateLabel
F411 | page: "After the 60-minute prompt cache expires, a cold return rewrites the whole chat. A handover saved before then lets a fresh session start from a short note." | source: "prompt cache lasts 60 minutes" | docs/RESEARCH.md:21 | source: "the first message back rewrites the whole context" | docs/RESEARCH.md:21 | source: "a fresh session reading it" | docs/HOW-IT-WORKS.md:324 | source: "short note about the work" | plugin/README.md:5 | source: "cold return at +65 min" | FACTS.md: Results method
