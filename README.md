# Claude Review

A VS Code extension that lets you review and approve or reject Claude's file changes at the hunk level — line-by-line, inline in your editor.

## How It Works

When Claude (or any AI tool) modifies files in your project, Claude Review captures a git baseline at the start of your session and tracks every change against it. Each changed file appears in a sidebar panel, and changed lines are highlighted directly in the editor with **Approve** and **Reject** buttons above each hunk.

- **Approve** — keeps the change as-is
- **Reject** — instantly reverts that chunk of lines back to the original

No modals, no popups — everything happens inline where you're already working.

## Features

- **Manual session toggle** — start and stop review sessions from the status bar; only changes made during an active session are tracked
- **Hunk-level review** — approve or reject individual groups of changed lines, not entire files
- **Instant revert** — rejected hunks are reverse-applied via `git apply --reverse` in real time
- **Sidebar panel** — "Claude Changes" view lists all modified files with per-file Approve All / Reject All actions
- **Git-based baseline** — uses `git stash create` to snapshot your working tree at session start without touching your uncommitted changes

## Installation

### From the VS Code Marketplace
Search for **Claude Review** in the VS Code Extensions panel and click Install.

### Manual install from `.vsix`
```bash
git clone https://github.com/slukehart/claude-review-extension
cd claude-review-extension
npm install
npm run compile
npx vsce package
code --install-extension claude-review-extension-0.0.1.vsix
```
Then restart VS Code.

## Requirements

- The workspace must be a **git repository**
- VS Code 1.109.0 or later

## Usage

1. Open a git repository in VS Code
2. Click **$(circle-slash) Start Claude Session** in the status bar
3. Let Claude make changes to your files
4. Open any modified file — changed lines are highlighted green with `✓ Approve` and `✗ Reject` buttons above each hunk
5. Click to approve or reject individual hunks
6. Click **Claude Session Active** in the status bar to end the session

The "Claude Changes" panel in the Explorer sidebar shows all modified files. You can approve or reject all hunks in a file at once from there.

## Extension Settings

No configuration required.

## How Rejection Works

When you reject a hunk, the extension:
1. Builds a reverse patch for that specific chunk of lines
2. Runs `git apply --reverse` against your workspace
3. The file updates instantly in the editor

Changes you approve are left as-is — no action is taken on approval beyond marking the hunk as reviewed.

## Limitations

- Requires a git repository (non-git projects are not supported)
- Session state is in-memory only — closing VS Code during a session ends it; any unapproved changes remain on disk
- Multi-root workspace support is not yet implemented

## License

MIT
