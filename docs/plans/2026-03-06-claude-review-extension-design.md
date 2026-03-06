# Claude Review Extension — Design Doc

**Date:** 2026-03-06
**Status:** Approved

---

## Overview

A VS Code extension that lets you review and approve or reject changes Claude makes to files — at the individual hunk (line group) level — during a manually toggled session.

---

## Architecture

### Baseline Strategy

On session start, the extension runs `git stash create`, which creates a stash object (a git commit hash) capturing the current working tree state **without modifying the working tree**. This hash is stored in memory as `sessionBaseline`. All subsequent file change diffs are computed against this baseline.

- Works even if there are pre-existing uncommitted changes
- Survives file renames and moves
- No cleanup required — unused stash objects are eventually garbage collected by git

### Core Modules

| Module | Responsibility |
|--------|---------------|
| `SessionManager` | Start/stop session, create/clear baseline, activate/deactivate file watcher |
| `ChangeTracker` | Maintain map of modified files → parsed hunk arrays |
| `DiffParser` | Parse `git diff` output into structured hunk objects |
| `HunkApplicator` | Reverse-apply specific hunks via `git apply --reverse` |
| `DecorationProvider` | Apply inline CodeLens + line highlighting in the editor |
| `SidebarProvider` | TreeView data provider for the "Claude Changes" panel |
| `StatusBarItem` | Toggle button + session state indicator |

---

## UI Components

### Status Bar
- Inactive: `$(circle-slash) Start Claude Session`
- Active: `$(pulse) Claude Session Active` (highlighted accent color)
- Click to toggle session on/off

### Sidebar Panel ("Claude Changes")
- Tree view in the Explorer sidebar
- Nodes: one per modified file
- Per-file inline actions: `Approve All` | `Reject All`
- File nodes expand to show individual hunks with line range labels (e.g., `Lines 24–31`)

### Inline Editor Decorations
- **Added lines:** green background highlight
- **Removed lines:** red background highlight (shown as ghost text or gutter indicator)
- **CodeLens above each hunk:** `✓ Approve` and `✗ Reject` buttons
- **Approved hunk:** subtle checkmark gutter icon, highlight fades
- **Rejected hunk:** decoration clears immediately as lines revert

---

## Data Flow

### Session Start
1. User clicks status bar
2. Extension runs `git stash create` → stores hash as `sessionBaseline`
3. `FileSystemWatcher` activates on workspace root
4. Status bar updates to active state

### File Change Detected
1. Watcher fires for changed file path
2. Extension runs `git diff <sessionBaseline> -- <filepath>`
3. `DiffParser` parses output into hunk array: `{ startLine, lineCount, added[], removed[] }[]`
4. `ChangeTracker` stores hunks for that file
5. File appears in sidebar tree view
6. If file is open in editor, decorations applied immediately

### User Opens a Modified File
1. `DecorationProvider` checks `ChangeTracker` for pending hunks
2. Applies CodeLens + line highlights for each unapproved hunk

### User Clicks Reject on a Hunk
1. `HunkApplicator` generates a minimal patch for that single hunk
2. Runs `git apply --reverse` with that patch
3. VS Code reloads the file content
4. Decoration clears for that hunk
5. If all hunks in a file are resolved → file removed from sidebar

### User Clicks Approve on a Hunk
1. Hunk marked `approved: true` in `ChangeTracker` — no file system action
2. Decoration updates to checkmark/approved style

### Session End
1. User clicks status bar to stop
2. All remaining unapproved hunks persist (Claude's changes stay unless explicitly rejected)
3. Watcher deactivates
4. Sidebar clears
5. `sessionBaseline` discarded from memory

---

## Key Decisions

- **Write-first model:** Claude writes files normally; review/revert is after-the-fact. No interception of writes.
- **Git required:** The project must be a git repository. Extension shows an error if no git repo is detected on session start.
- **No persistence:** Session state is in-memory only. Closing VS Code mid-session ends the session; unapproved changes remain on disk.
- **Manual session toggle only:** The watcher never auto-activates. User always explicitly starts a session.

---

## Tech Stack

- **Language:** TypeScript
- **Extension API:** VS Code Extension API (`vscode` module)
- **Diff/patch:** `git diff` + `git apply --reverse` via child process
- **UI:** CodeLens, TextEditorDecorationType, TreeDataProvider, StatusBarItem

---

## Out of Scope

- Non-git projects
- Auto-detection of Claude process
- Persisting session state across VS Code restarts
- Multi-workspace session support
