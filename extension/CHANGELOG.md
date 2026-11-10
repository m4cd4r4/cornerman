# Changelog

## 0.7.2

- **The relay no longer stops on work that never commits.** It stopped after two continued
  sessions with no new commit, so a Squarespace edit or research ran out after two. A handover
  that says something new now counts as progress too, and the commit check reads the folder the
  window started in, not wherever a `cd` left the session (#195).
- **Reading the save script no longer clears your session.** A session that printed the source
  of `save.mjs` (with `cat`, `sed` or `grep`) looked to the relay like one that had saved a
  handover, so it ran `/clear` mid-task with nothing saved. The relay now counts only a run of
  `save.mjs` that prints its own "Saved handover" line (#199).
- **Handovers keep what is decided but not done.** When a save leaves out a "Read first",
  "Decided, not yet applied", "Open questions" or "Progress" line from the previous handover in
  the same window, the save appends it word for word under "Carried forward from the previous
  handover" and lists it. A loaded handover tells the next session to open its "Read first"
  files before acting, and other waiting handovers show how many open items they hold (#194).
- **The loaded copy says which session it belongs to**, so another tab in the same window does
  not take it as its own (#198).
- **The save output is shorter and steadier.** Each folder is named one way (`~/...` under your
  home folder), the line saying what happens after `/clear` comes second instead of last, the
  auto-mode nudges are about half as long, and the sidebar search box stays in place (#186).

- **An old idle question no longer resumes on its own.** When an idle handover saved a question
  that was waiting for you, and its session then closed, a later `/clear` could load it and carry
  on with unrelated work. It is now retired when its session closes, and one that cannot be checked
  is listed for you to pick instead of loaded. When your newest handover is for another folder, the
  session start says which folder to open.
- **A large store no longer freezes the Claude Code panel in VS Code.** The sidebar refresh, the
  status bar check and the worktree lookup read files and ran git while holding VS Code's extension
  host, which made the Claude Code panel report "stopped responding". They now run in the
  background and reread only the files that changed.
- **Old relay files are cleared away.** Once a day, a session start removes the relay's files for
  windows idle 14 days or more, after writing one line per window to `~/.cornerman/ledger/`. A
  window that is still open is never touched. The sidebar's Archived group is sent only while it
  is open.

## 0.7.1

- **The footer shows again for new Claude tabs.** Questlog 1.0.0 (formerly Session Compass) moved
  its tab records to `~/.claude/questlog/`. Cornerman read only the old folder, so a tab started after
  the rename went unrecognised and the context and relay items hid. It now reads both, the new one
  first. Questlog is still optional.

## 0.7.0

- **Cornerman now clears and carries on by itself.** New installs and upgrades get the relay at 3
  clears per window, the nudge on and the idle handover on `smart`. Set any of them to off to stop it.
- **It says so once.** The first session after install tells you it is on, the limit, and how to stop
  it.

## 0.6.1

- **Sync no longer stops behind a secret scanner.** The store's per-window `relay/` files now stay out
  of git and stay on disk, and an existing store fixes itself at its next sync.

## 0.6.0

- **clear-resume is now cornerman.** New extension ID `macdara.cornerman`. Settings saved as
  `clearResume.*` are copied to `cornerman.*` the first time it starts, and it warns while the old
  extension is still installed.

## Unreleased

- **No more extension-host freezes from a large handover store.** The tree, lanes and status
  re-read every handover file on each store change, in every window. With about 1,900 handovers
  that blocked VS Code's extension host long enough for Claude Code's chat tab to report
  "stopped responding". Unchanged files are now read once.

- **Assets under each handover.** Open a row's chevron and its session's tables, lists, links and paths
  are listed under **Assets**, collapsed by default. A click opens a link in the browser, a path in the
  editor, a table or list in a markdown tab, or the last screen. Needs the plugin's new SessionEnd hook.

Needs a clear-resume plugin with the hand-over poll in its relay mod.

- The nudge size and **Hand over** moved from the status bar into the context pie's hover card,
  as links under the relay log. The status bar keeps the pie and the relay count.

- A fresh Claude tab no longer shows the previous tab's context count. While compass has no
  row for the focused tab, the pie, relay, nudge and Hand over items are hidden, and the
  relay lookup returns nothing instead of a sibling tab's file.

- The nudge size you pick in the footer now survives a reload. A reload writes a new relay file
  for the same session, which used to lose the pick and fall back to the plugin option. The new
  file takes the newest pick made on any relay file holding the same session. A new tab still
  starts at the default.

- The handover status-bar item is gone. The context pie's hover card now shows the handover
  the focused tab's Claude process loaded, so a parallel session's handover no longer shows in
  every tab. Open handover is a link in the same card.

- A **Hand over** item in the status bar has the window's Claude session write a handover
  now. With the relay on it then clears and continues by itself; with it off it only saves.
  A click during a reply waits for the reply to finish.

## 0.4.0

Needs the clear-resume plugin 0.4.0 or later for the context pie and the relay item.

- A **context pie** in the status bar fills towards the plugin's nudge size: amber from
  80%, red past it. Its hover card shows the relay, the chain of continued sessions and
  an upper bound on what the clears saved.
- A **relay** item shows this window's clears used against its budget. Click it to pick a
  new budget or turn the relay off.
- With two windows on one repo, each status bar names the handover its own window loaded
  and reads its own session's context, not the folder's newest.
- A **Worktrees** view lists the open repo's git worktrees oldest first, each with its
  branch, start time and newest handover's state. Click one to open it in its own
  window (`clear-resume: Open worktree window`).
- New setting `clearResume.registryPath`: point it at a worktree registry and each row
  names its plan row, plan position and wave, with queued entries under Next up
  (folded past 8).
- Plugin: `scripts/label.mjs <slug> --registry <file>` prints the same label as JSON,
  for scripts that name windows or kickoff handovers.
- Plugin: `save.mjs --unowned` writes a handover for a session that has not started
  yet, so it is not marked as held by the window that wrote it.

## 0.2.2

- The store listing shows two screenshots: the sidebar with a loaded handover open, and Resume
  filling in a Claude Code tab.

## 0.2.1

First Marketplace release.

- Handovers sidebar in the activity bar, grouped into Current repo, Other repos
  and Stale.
- A Loaded group at the top of the sidebar lists the handovers loaded in the
  last 24 hours. Click one to open its readable copy.
- A status-bar item names the handover this repo loaded most recently, with how
  long ago. Click it to open the same copy. It is hidden when there is none.
- Resume opens a Claude Code tab with the handover's prompt pre-filled, so you
  can read it before you send it.
- Pin keeps a handover out of the stale and delete timers.
- Reads and writes the same local JSON store as the clear-resume plugin, so a
  handover written by the plugin shows up here with no extra setup.
- Nothing leaves your machine unless you set up syncing. Once the store is
  synced, a resume, pin, unpin or delete in the sidebar pushes it to your git
  remote in the background.
