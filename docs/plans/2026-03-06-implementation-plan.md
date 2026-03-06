# Claude Review Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a VS Code extension that lets users approve or reject Claude's file changes at the hunk (line group) level using a manually toggled session and git as the baseline.

**Architecture:** On session start, `git stash create` captures the current working tree as a baseline hash. A file system watcher detects changes during the session and diffs them against the baseline. Users approve/reject individual hunks via CodeLens buttons; rejections are reverse-applied using `git apply --reverse`.

**Tech Stack:** TypeScript, VS Code Extension API, Node.js `child_process`, Mocha + Sinon for unit tests

---

## Project Structure

```
claude-review-extension/
├── package.json
├── tsconfig.json
├── .vscodeignore
├── src/
│   ├── extension.ts
│   ├── SessionManager.ts
│   ├── ChangeTracker.ts
│   ├── DiffParser.ts
│   ├── HunkApplicator.ts
│   ├── DecorationProvider.ts
│   ├── SidebarProvider.ts
│   └── StatusBarController.ts
└── test/
    ├── DiffParser.test.ts
    ├── ChangeTracker.test.ts
    └── HunkApplicator.test.ts
```

---

### Task 1: Scaffold the Project

**Files:**
- Create: `claude-review-extension/package.json`
- Create: `claude-review-extension/tsconfig.json`
- Create: `claude-review-extension/.vscodeignore`
- Create: `claude-review-extension/src/extension.ts`

**Step 1: Initialize the project**

```bash
cd /Users/slukehart/Documents/Github/claude-review-extension
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install --save-dev typescript @types/node @types/vscode mocha @types/mocha sinon @types/sinon ts-node
```

**Step 3: Write `package.json`**

Replace the generated `package.json` with:

```json
{
  "name": "claude-review-extension",
  "displayName": "Claude Review",
  "description": "Review and approve/reject Claude's file changes at the hunk level",
  "version": "0.0.1",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "claudeReview.toggleSession",
        "title": "Toggle Claude Session"
      },
      {
        "command": "claudeReview.approveHunk",
        "title": "Approve Hunk"
      },
      {
        "command": "claudeReview.rejectHunk",
        "title": "Reject Hunk"
      },
      {
        "command": "claudeReview.approveAllInFile",
        "title": "Approve All"
      },
      {
        "command": "claudeReview.rejectAllInFile",
        "title": "Reject All"
      }
    ],
    "views": {
      "explorer": [
        {
          "id": "claudeChanges",
          "name": "Claude Changes"
        }
      ]
    }
  },
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "mocha --require ts-node/register test/**/*.test.ts"
  },
  "devDependencies": {}
}
```

**Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "out"]
}
```

**Step 5: Write stub `src/extension.ts`**

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Claude Review extension activated');
}

export function deactivate(): void {}
```

**Step 6: Compile and verify no errors**

```bash
cd /Users/slukehart/Documents/Github/claude-review-extension
npx tsc --noEmit
```
Expected: no output (no errors)

**Step 7: Commit**

```bash
git init
git add package.json tsconfig.json src/extension.ts .vscodeignore
git commit -m "chore: scaffold claude-review-extension project"
```

---

### Task 2: DiffParser — Parse git diff output into Hunk objects

**Files:**
- Create: `src/DiffParser.ts`
- Create: `test/DiffParser.test.ts`

**Hunk type** (add to `src/DiffParser.ts`):

```typescript
export interface Hunk {
  id: string;          // unique id: `${filePath}:${newStart}`
  filePath: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];     // raw diff lines including leading +/-/space
  approved: boolean;
}
```

**Step 1: Write the failing tests**

Create `test/DiffParser.test.ts`:

```typescript
import * as assert from 'assert';
import { parseDiff } from '../src/DiffParser';

const SAMPLE_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index abc1234..def5678 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,4 +1,5 @@
 line1
-line2
+line2 modified
+line2b added
 line3
 line4
@@ -10,3 +11,3 @@
 line10
-line11
+line11 modified
 line12
`;

describe('DiffParser', () => {
  it('returns empty array for empty diff', () => {
    const result = parseDiff('', 'src/foo.ts');
    assert.deepStrictEqual(result, []);
  });

  it('parses two hunks from diff output', () => {
    const result = parseDiff(SAMPLE_DIFF, 'src/foo.ts');
    assert.strictEqual(result.length, 2);
  });

  it('first hunk has correct line range', () => {
    const result = parseDiff(SAMPLE_DIFF, 'src/foo.ts');
    assert.strictEqual(result[0].oldStart, 1);
    assert.strictEqual(result[0].oldCount, 4);
    assert.strictEqual(result[0].newStart, 1);
    assert.strictEqual(result[0].newCount, 5);
  });

  it('second hunk has correct line range', () => {
    const result = parseDiff(SAMPLE_DIFF, 'src/foo.ts');
    assert.strictEqual(result[1].oldStart, 10);
    assert.strictEqual(result[1].newStart, 11);
  });

  it('hunks have filePath set', () => {
    const result = parseDiff(SAMPLE_DIFF, 'src/foo.ts');
    assert.strictEqual(result[0].filePath, 'src/foo.ts');
  });

  it('hunks are not approved by default', () => {
    const result = parseDiff(SAMPLE_DIFF, 'src/foo.ts');
    assert.strictEqual(result[0].approved, false);
    assert.strictEqual(result[1].approved, false);
  });

  it('hunk id is unique per hunk', () => {
    const result = parseDiff(SAMPLE_DIFF, 'src/foo.ts');
    assert.notStrictEqual(result[0].id, result[1].id);
  });

  it('hunk lines include the +/- prefix characters', () => {
    const result = parseDiff(SAMPLE_DIFF, 'src/foo.ts');
    const firstHunkLines = result[0].lines;
    assert.ok(firstHunkLines.some(l => l.startsWith('-')));
    assert.ok(firstHunkLines.some(l => l.startsWith('+')));
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/slukehart/Documents/Github/claude-review-extension
npm test
```
Expected: FAIL — `Cannot find module '../src/DiffParser'`

**Step 3: Implement `src/DiffParser.ts`**

```typescript
export interface Hunk {
  id: string;
  filePath: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
  approved: boolean;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseDiff(diffOutput: string, filePath: string): Hunk[] {
  if (!diffOutput.trim()) return [];

  const hunks: Hunk[] = [];
  const lines = diffOutput.split('\n');
  let currentHunk: Hunk | null = null;

  for (const line of lines) {
    const match = HUNK_HEADER.exec(line);
    if (match) {
      if (currentHunk) hunks.push(currentHunk);
      const oldStart = parseInt(match[1], 10);
      const oldCount = match[2] !== undefined ? parseInt(match[2], 10) : 1;
      const newStart = parseInt(match[3], 10);
      const newCount = match[4] !== undefined ? parseInt(match[4], 10) : 1;
      currentHunk = {
        id: `${filePath}:${newStart}`,
        filePath,
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: [],
        approved: false,
      };
    } else if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      currentHunk.lines.push(line);
    }
  }

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: 8 passing

**Step 5: Commit**

```bash
git add src/DiffParser.ts test/DiffParser.test.ts
git commit -m "feat: add DiffParser with hunk parsing"
```

---

### Task 3: ChangeTracker — Track hunk state per file

**Files:**
- Create: `src/ChangeTracker.ts`
- Create: `test/ChangeTracker.test.ts`

**Step 1: Write the failing tests**

Create `test/ChangeTracker.test.ts`:

```typescript
import * as assert from 'assert';
import { ChangeTracker } from '../src/ChangeTracker';
import { Hunk } from '../src/DiffParser';

function makeHunk(id: string, filePath: string): Hunk {
  return { id, filePath, oldStart: 1, oldCount: 1, newStart: 1, newCount: 1, lines: ['+foo'], approved: false };
}

describe('ChangeTracker', () => {
  let tracker: ChangeTracker;

  beforeEach(() => {
    tracker = new ChangeTracker();
  });

  it('starts with no files', () => {
    assert.deepStrictEqual(tracker.getAllFiles(), []);
  });

  it('setHunks adds a file', () => {
    tracker.setHunks('src/foo.ts', [makeHunk('a', 'src/foo.ts')]);
    assert.deepStrictEqual(tracker.getAllFiles(), ['src/foo.ts']);
  });

  it('getHunks returns hunks for a file', () => {
    const hunk = makeHunk('a', 'src/foo.ts');
    tracker.setHunks('src/foo.ts', [hunk]);
    assert.strictEqual(tracker.getHunks('src/foo.ts')?.length, 1);
  });

  it('getHunks returns undefined for unknown file', () => {
    assert.strictEqual(tracker.getHunks('nonexistent.ts'), undefined);
  });

  it('approveHunk marks hunk as approved', () => {
    const hunk = makeHunk('hunk-1', 'src/foo.ts');
    tracker.setHunks('src/foo.ts', [hunk]);
    tracker.approveHunk('src/foo.ts', 'hunk-1');
    assert.strictEqual(tracker.getHunks('src/foo.ts')![0].approved, true);
  });

  it('removeHunk removes hunk from file', () => {
    tracker.setHunks('src/foo.ts', [makeHunk('h1', 'src/foo.ts'), makeHunk('h2', 'src/foo.ts')]);
    tracker.removeHunk('src/foo.ts', 'h1');
    assert.strictEqual(tracker.getHunks('src/foo.ts')?.length, 1);
  });

  it('removes file from list when last hunk removed', () => {
    tracker.setHunks('src/foo.ts', [makeHunk('h1', 'src/foo.ts')]);
    tracker.removeHunk('src/foo.ts', 'h1');
    assert.deepStrictEqual(tracker.getAllFiles(), []);
  });

  it('clear removes all files', () => {
    tracker.setHunks('src/foo.ts', [makeHunk('a', 'src/foo.ts')]);
    tracker.setHunks('src/bar.ts', [makeHunk('b', 'src/bar.ts')]);
    tracker.clear();
    assert.deepStrictEqual(tracker.getAllFiles(), []);
  });

  it('hasUnresolved returns true when unapproved hunks exist', () => {
    tracker.setHunks('src/foo.ts', [makeHunk('h1', 'src/foo.ts')]);
    assert.strictEqual(tracker.hasUnresolved('src/foo.ts'), true);
  });

  it('hasUnresolved returns false when all hunks approved', () => {
    tracker.setHunks('src/foo.ts', [makeHunk('h1', 'src/foo.ts')]);
    tracker.approveHunk('src/foo.ts', 'h1');
    assert.strictEqual(tracker.hasUnresolved('src/foo.ts'), false);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module '../src/ChangeTracker'`

**Step 3: Implement `src/ChangeTracker.ts`**

```typescript
import { Hunk } from './DiffParser';

export class ChangeTracker {
  private fileHunks: Map<string, Hunk[]> = new Map();

  setHunks(filePath: string, hunks: Hunk[]): void {
    this.fileHunks.set(filePath, hunks);
  }

  getHunks(filePath: string): Hunk[] | undefined {
    return this.fileHunks.get(filePath);
  }

  getAllFiles(): string[] {
    return Array.from(this.fileHunks.keys());
  }

  approveHunk(filePath: string, hunkId: string): void {
    const hunks = this.fileHunks.get(filePath);
    if (!hunks) return;
    const hunk = hunks.find(h => h.id === hunkId);
    if (hunk) hunk.approved = true;
  }

  removeHunk(filePath: string, hunkId: string): void {
    const hunks = this.fileHunks.get(filePath);
    if (!hunks) return;
    const filtered = hunks.filter(h => h.id !== hunkId);
    if (filtered.length === 0) {
      this.fileHunks.delete(filePath);
    } else {
      this.fileHunks.set(filePath, filtered);
    }
  }

  hasUnresolved(filePath: string): boolean {
    const hunks = this.fileHunks.get(filePath);
    if (!hunks) return false;
    return hunks.some(h => !h.approved);
  }

  clear(): void {
    this.fileHunks.clear();
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: all passing

**Step 5: Commit**

```bash
git add src/ChangeTracker.ts test/ChangeTracker.test.ts
git commit -m "feat: add ChangeTracker for hunk state management"
```

---

### Task 4: HunkApplicator — Reverse-apply a rejected hunk

**Files:**
- Create: `src/HunkApplicator.ts`
- Create: `test/HunkApplicator.test.ts`

**Step 1: Write the failing tests**

Create `test/HunkApplicator.test.ts`:

```typescript
import * as assert from 'assert';
import * as sinon from 'sinon';
import { buildReversePatch, rejectHunk } from '../src/HunkApplicator';
import { Hunk } from '../src/DiffParser';
import * as child_process from 'child_process';

function makeHunk(overrides: Partial<Hunk> = {}): Hunk {
  return {
    id: 'src/foo.ts:5',
    filePath: 'src/foo.ts',
    oldStart: 5,
    oldCount: 2,
    newStart: 5,
    newCount: 3,
    lines: [' context', '-removed', '+added1', '+added2'],
    approved: false,
    ...overrides,
  };
}

describe('HunkApplicator', () => {
  describe('buildReversePatch', () => {
    it('produces a valid unified diff header', () => {
      const patch = buildReversePatch(makeHunk(), '/workspace');
      assert.ok(patch.includes('--- a/src/foo.ts'));
      assert.ok(patch.includes('+++ b/src/foo.ts'));
    });

    it('includes the hunk header', () => {
      const patch = buildReversePatch(makeHunk(), '/workspace');
      assert.ok(patch.includes('@@ -5,'));
    });

    it('includes the diff lines', () => {
      const patch = buildReversePatch(makeHunk(), '/workspace');
      assert.ok(patch.includes('-removed'));
      assert.ok(patch.includes('+added1'));
    });
  });

  describe('rejectHunk', () => {
    let execStub: sinon.SinonStub;

    beforeEach(() => {
      execStub = sinon.stub(child_process, 'exec');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('calls git apply --reverse with the patch via stdin', async () => {
      execStub.callsFake((_cmd: string, _opts: object, cb: Function) => cb(null, '', ''));
      await rejectHunk(makeHunk(), '/workspace');
      assert.ok(execStub.calledOnce);
      const cmd: string = execStub.firstCall.args[0];
      assert.ok(cmd.includes('git apply --reverse'));
    });

    it('throws if git apply fails', async () => {
      execStub.callsFake((_cmd: string, _opts: object, cb: Function) => cb(new Error('apply failed'), '', 'error'));
      await assert.rejects(() => rejectHunk(makeHunk(), '/workspace'), /apply failed/);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module '../src/HunkApplicator'`

**Step 3: Implement `src/HunkApplicator.ts`**

```typescript
import { exec } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Hunk } from './DiffParser';

export function buildReversePatch(hunk: Hunk, workspaceRoot: string): string {
  const relPath = hunk.filePath;
  const header = `--- a/${relPath}\n+++ b/${relPath}\n`;
  const hunkHeader = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
  const body = hunk.lines.join('\n') + '\n';
  return header + hunkHeader + body;
}

export function rejectHunk(hunk: Hunk, workspaceRoot: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const patch = buildReversePatch(hunk, workspaceRoot);
    const tmpFile = path.join(os.tmpdir(), `claude-review-${Date.now()}.patch`);
    fs.writeFileSync(tmpFile, patch, 'utf8');

    const cmd = `git apply --reverse "${tmpFile}"`;
    exec(cmd, { cwd: workspaceRoot }, (err, _stdout, stderr) => {
      fs.unlinkSync(tmpFile);
      if (err) {
        reject(new Error(err.message + '\n' + stderr));
      } else {
        resolve();
      }
    });
  });
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: all passing

**Step 5: Commit**

```bash
git add src/HunkApplicator.ts test/HunkApplicator.test.ts
git commit -m "feat: add HunkApplicator for reversing rejected hunks"
```

---

### Task 5: SessionManager — Start/stop session with git baseline

**Files:**
- Create: `src/SessionManager.ts`

> Note: SessionManager calls VS Code APIs and `child_process`. Unit test the git logic via mocks; skip VS Code FileSystemWatcher in unit tests (integration tested manually).

**Step 1: Implement `src/SessionManager.ts`**

```typescript
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SessionManager {
  private baseline: string | null = null;
  private watcher: vscode.FileSystemWatcher | null = null;
  private _isActive = false;

  get isActive(): boolean {
    return this._isActive;
  }

  get sessionBaseline(): string | null {
    return this.baseline;
  }

  async start(
    workspaceRoot: string,
    onFileChange: (filePath: string) => void
  ): Promise<void> {
    if (this._isActive) return;

    // Verify git repo
    try {
      await execAsync('git rev-parse --git-dir', { cwd: workspaceRoot });
    } catch {
      throw new Error('Claude Review: No git repository found in workspace.');
    }

    // Create baseline stash object (does not modify working tree)
    const { stdout } = await execAsync('git stash create', { cwd: workspaceRoot });
    const hash = stdout.trim();

    if (!hash) {
      // No changes from HEAD — use HEAD as baseline
      const head = await execAsync('git rev-parse HEAD', { cwd: workspaceRoot });
      this.baseline = head.stdout.trim();
    } else {
      this.baseline = hash;
    }

    // Watch all files in workspace
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, true);
    this.watcher.onDidChange(uri => onFileChange(uri.fsPath));
    this.watcher.onDidCreate(uri => onFileChange(uri.fsPath));

    this._isActive = true;
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }
    this.baseline = null;
    this._isActive = false;
  }
}
```

**Step 2: Compile and verify no TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/SessionManager.ts
git commit -m "feat: add SessionManager with git stash baseline"
```

---

### Task 6: StatusBarController — Toggle button in status bar

**Files:**
- Create: `src/StatusBarController.ts`

**Step 1: Implement `src/StatusBarController.ts`**

```typescript
import * as vscode from 'vscode';

export class StatusBarController {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'claudeReview.toggleSession';
    this.setInactive();
    this.item.show();
  }

  setActive(): void {
    this.item.text = '$(pulse) Claude Session Active';
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.item.tooltip = 'Click to stop Claude review session';
  }

  setInactive(): void {
    this.item.text = '$(circle-slash) Start Claude Session';
    this.item.backgroundColor = undefined;
    this.item.tooltip = 'Click to start Claude review session';
  }

  dispose(): void {
    this.item.dispose();
  }
}
```

**Step 2: Compile and verify**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/StatusBarController.ts
git commit -m "feat: add StatusBarController"
```

---

### Task 7: SidebarProvider — TreeView of changed files and hunks

**Files:**
- Create: `src/SidebarProvider.ts`

**Step 1: Implement `src/SidebarProvider.ts`**

```typescript
import * as vscode from 'vscode';
import { ChangeTracker } from './ChangeTracker';
import { Hunk } from './DiffParser';

type TreeNode = FileNode | HunkNode;

export class FileNode extends vscode.TreeItem {
  constructor(public readonly filePath: string) {
    super(vscode.Uri.file(filePath), vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'claudeFile';
    this.description = 'pending changes';
  }
}

export class HunkNode extends vscode.TreeItem {
  constructor(public readonly hunk: Hunk) {
    super(
      `Lines ${hunk.newStart}–${hunk.newStart + hunk.newCount - 1}`,
      vscode.TreeItemCollapsibleState.None
    );
    this.contextValue = 'claudeHunk';
    this.description = hunk.approved ? '✓ approved' : 'pending';
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(hunk.filePath), { selection: new vscode.Range(hunk.newStart - 1, 0, hunk.newStart - 1, 0) }],
    };
  }
}

export class SidebarProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly tracker: ChangeTracker) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return this.tracker.getAllFiles().map(f => new FileNode(f));
    }
    if (element instanceof FileNode) {
      return (this.tracker.getHunks(element.filePath) ?? []).map(h => new HunkNode(h));
    }
    return [];
  }
}
```

**Step 2: Compile and verify**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/SidebarProvider.ts
git commit -m "feat: add SidebarProvider tree view"
```

---

### Task 8: DecorationProvider — Inline hunk highlights and CodeLens

**Files:**
- Create: `src/DecorationProvider.ts`

**Step 1: Implement `src/DecorationProvider.ts`**

```typescript
import * as vscode from 'vscode';
import { ChangeTracker } from './ChangeTracker';
import { Hunk } from './DiffParser';

const addedDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(0, 255, 0, 0.12)',
  isWholeLine: true,
});

const removedDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 0, 0, 0.12)',
  isWholeLine: true,
  after: { contentText: ' [removed]', color: 'rgba(255,100,100,0.7)' },
});

const approvedDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: new vscode.ThemeIcon('check').id as unknown as vscode.Uri,
  after: { contentText: ' ✓', color: 'rgba(100,200,100,0.8)' },
  isWholeLine: true,
});

export class DecorationProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private readonly tracker: ChangeTracker) {}

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
    this.applyDecorations();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const filePath = document.uri.fsPath;
    const hunks = this.tracker.getHunks(filePath);
    if (!hunks) return [];

    return hunks.flatMap(hunk => {
      const line = Math.max(0, hunk.newStart - 1);
      const range = new vscode.Range(line, 0, line, 0);

      if (hunk.approved) {
        return [new vscode.CodeLens(range, { title: '✓ Approved', command: '' })];
      }

      return [
        new vscode.CodeLens(range, {
          title: '✓ Approve',
          command: 'claudeReview.approveHunk',
          arguments: [filePath, hunk.id],
        }),
        new vscode.CodeLens(range, {
          title: '✗ Reject',
          command: 'claudeReview.rejectHunk',
          arguments: [filePath, hunk.id],
        }),
      ];
    });
  }

  applyDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const filePath = editor.document.uri.fsPath;
      const hunks = this.tracker.getHunks(filePath);

      if (!hunks) {
        editor.setDecorations(addedDecoration, []);
        editor.setDecorations(removedDecoration, []);
        editor.setDecorations(approvedDecoration, []);
        continue;
      }

      const addedRanges: vscode.Range[] = [];
      const approvedRanges: vscode.Range[] = [];

      for (const hunk of hunks) {
        let lineOffset = hunk.newStart - 1;
        for (const line of hunk.lines) {
          if (line.startsWith('+')) {
            const range = new vscode.Range(lineOffset, 0, lineOffset, 0);
            if (hunk.approved) {
              approvedRanges.push(range);
            } else {
              addedRanges.push(range);
            }
            lineOffset++;
          } else if (line.startsWith(' ')) {
            lineOffset++;
          }
          // '-' lines don't advance line offset (they're removed)
        }
      }

      editor.setDecorations(addedDecoration, addedRanges);
      editor.setDecorations(approvedDecoration, approvedRanges);
    }
  }
}
```

**Step 2: Compile and verify**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/DecorationProvider.ts
git commit -m "feat: add DecorationProvider with CodeLens and line highlights"
```

---

### Task 9: Wire Everything Together in extension.ts

**Files:**
- Modify: `src/extension.ts`

**Step 1: Implement the full `src/extension.ts`**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { execSync } from 'child_process';
import { SessionManager } from './SessionManager';
import { ChangeTracker } from './ChangeTracker';
import { DiffParser } from './DiffParser';
import { HunkApplicator } from './HunkApplicator';
import { StatusBarController } from './StatusBarController';
import { SidebarProvider } from './SidebarProvider';
import { DecorationProvider } from './DecorationProvider';
import { parseDiff } from './DiffParser';
import { rejectHunk } from './HunkApplicator';

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  const tracker = new ChangeTracker();
  const session = new SessionManager();
  const statusBar = new StatusBarController();
  const sidebar = new SidebarProvider(tracker);
  const decorations = new DecorationProvider(tracker);

  vscode.window.registerTreeDataProvider('claudeChanges', sidebar);
  vscode.languages.registerCodeLensProvider({ pattern: '**/*' }, decorations);

  // Refresh decorations when visible editors change
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => decorations.applyDecorations())
  );

  async function handleFileChange(fsPath: string): Promise<void> {
    if (!workspaceRoot || !session.isActive || !session.sessionBaseline) return;

    const relPath = path.relative(workspaceRoot, fsPath);
    // Skip .git directory and non-text files
    if (relPath.startsWith('.git')) return;

    try {
      const { execSync } = await import('child_process');
      const diff = execSync(
        `git diff ${session.sessionBaseline} -- "${relPath}"`,
        { cwd: workspaceRoot }
      ).toString();

      const hunks = parseDiff(diff, fsPath);
      if (hunks.length > 0) {
        tracker.setHunks(fsPath, hunks);
      } else {
        // File reverted to baseline — remove from tracker
        tracker.getAllFiles().filter(f => f === fsPath).forEach(() => tracker.clear());
      }

      sidebar.refresh();
      decorations.refresh();
    } catch {
      // File may be binary or outside git — ignore
    }
  }

  // Toggle session command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeReview.toggleSession', async () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('Claude Review: No workspace folder open.');
        return;
      }
      if (session.isActive) {
        session.stop();
        tracker.clear();
        sidebar.refresh();
        decorations.refresh();
        statusBar.setInactive();
        vscode.window.showInformationMessage('Claude review session ended.');
      } else {
        try {
          await session.start(workspaceRoot, handleFileChange);
          statusBar.setActive();
          vscode.window.showInformationMessage('Claude review session started. Claude\'s changes will appear here for review.');
        } catch (err: any) {
          vscode.window.showErrorMessage(err.message);
        }
      }
    })
  );

  // Approve hunk command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeReview.approveHunk', (filePath: string, hunkId: string) => {
      tracker.approveHunk(filePath, hunkId);
      sidebar.refresh();
      decorations.refresh();
    })
  );

  // Reject hunk command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeReview.rejectHunk', async (filePath: string, hunkId: string) => {
      if (!workspaceRoot) return;
      const hunks = tracker.getHunks(filePath);
      const hunk = hunks?.find(h => h.id === hunkId);
      if (!hunk) return;

      try {
        await rejectHunk(hunk, workspaceRoot);
        tracker.removeHunk(filePath, hunkId);
        sidebar.refresh();
        decorations.refresh();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to reject hunk: ${err.message}`);
      }
    })
  );

  // Approve all hunks in a file
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeReview.approveAllInFile', (filePath: string) => {
      const hunks = tracker.getHunks(filePath) ?? [];
      for (const hunk of hunks) {
        tracker.approveHunk(filePath, hunk.id);
      }
      sidebar.refresh();
      decorations.refresh();
    })
  );

  // Reject all hunks in a file
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeReview.rejectAllInFile', async (filePath: string) => {
      if (!workspaceRoot) return;
      const hunks = tracker.getHunks(filePath) ?? [];
      for (const hunk of hunks) {
        try {
          await rejectHunk(hunk, workspaceRoot);
          tracker.removeHunk(filePath, hunk.id);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to reject hunk: ${err.message}`);
        }
      }
      sidebar.refresh();
      decorations.refresh();
    })
  );

  context.subscriptions.push(statusBar);
}

export function deactivate(): void {}
```

**Step 2: Compile**

```bash
npx tsc
```
Expected: `out/` directory populated, no errors

**Step 3: Run all unit tests one final time**

```bash
npm test
```
Expected: all passing

**Step 4: Commit**

```bash
git add src/extension.ts
git commit -m "feat: wire all modules together in extension.ts"
```

---

### Task 10: Manual Integration Test

**Step 1: Open the extension in VS Code's Extension Development Host**

In VS Code with this project open, press `F5`. This opens a new VS Code window with the extension loaded.

**Step 2: Open a git repo in the Extension Development Host window**

Open any git repository folder.

**Step 3: Verify status bar shows**

Expected: `$(circle-slash) Start Claude Session` in the status bar.

**Step 4: Start a session**

Click the status bar item.
Expected: status bar changes to `$(pulse) Claude Session Active`.

**Step 5: Modify a tracked file**

Open a terminal and modify any file in the repo (simulating Claude making a change):
```bash
echo "// claude was here" >> src/someFile.ts
```

**Step 6: Verify sidebar shows the file**

Expected: "Claude Changes" panel in Explorer sidebar shows `someFile.ts`.

**Step 7: Open the modified file**

Expected: green highlighted lines + CodeLens buttons `✓ Approve` and `✗ Reject` appear above the changed hunk.

**Step 8: Click Reject**

Expected: the added line disappears, file reverts, file is removed from sidebar.

**Step 9: Stop session**

Click status bar.
Expected: returns to inactive state, sidebar clears.

**Step 10: Commit**

```bash
git add .
git commit -m "feat: complete claude-review-extension v0.1"
```
