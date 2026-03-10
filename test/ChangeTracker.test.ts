import * as assert from 'assert';
import * as vscode from 'vscode';
import { ChangeTracker } from '../src/ChangeTracker';
import { Hunk } from '../src/DiffParser';

function makeFakeState(): vscode.Memento & { _store: Map<string, any> } {
  const _store = new Map<string, any>();
  return {
    _store,
    get<T>(key: string, defaultValue?: T): T {
      return (_store.has(key) ? _store.get(key) : defaultValue) as T;
    },
    update(key: string, value: any): Thenable<void> {
      _store.set(key, value);
      return Promise.resolve();
    },
    keys(): readonly string[] {
      return Array.from(_store.keys());
    },
  };
}

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

describe('ChangeTracker with workspaceState', () => {
  it('works without ctx argument (no crash, no persistence)', () => {
    const tracker = new ChangeTracker();
    tracker.setHunks('src/foo.ts', [makeHunk('h1', 'src/foo.ts')]);
    assert.strictEqual(tracker.getHunks('src/foo.ts')?.length, 1);
  });

  it('persists hunks to workspaceState on setHunks', () => {
    const state = makeFakeState();
    const tracker = new ChangeTracker(state);
    tracker.setHunks('src/foo.ts', [makeHunk('h1', 'src/foo.ts')]);
    const stored = state._store.get('claudeReview.hunks');
    assert.ok(stored, 'expected hunks to be stored');
    assert.ok(stored['src/foo.ts'], 'expected src/foo.ts key in stored hunks');
  });

  it('restores hunks from workspaceState on construction', () => {
    const state = makeFakeState();
    const hunk = makeHunk('h1', 'src/foo.ts');
    state._store.set('claudeReview.hunks', { 'src/foo.ts': [hunk] });
    const tracker = new ChangeTracker(state);
    assert.strictEqual(tracker.getHunks('src/foo.ts')?.length, 1);
  });

  it('restores approved state from workspaceState', () => {
    const state = makeFakeState();
    const hunk = { ...makeHunk('h1', 'src/foo.ts'), approved: true };
    state._store.set('claudeReview.hunks', { 'src/foo.ts': [hunk] });
    const tracker = new ChangeTracker(state);
    assert.strictEqual(tracker.getHunks('src/foo.ts')![0].approved, true);
  });

  it('persists approval state changes', () => {
    const state = makeFakeState();
    const tracker = new ChangeTracker(state);
    tracker.setHunks('src/foo.ts', [makeHunk('h1', 'src/foo.ts')]);
    tracker.approveHunk('src/foo.ts', 'h1');
    const stored = state._store.get('claudeReview.hunks');
    assert.strictEqual(stored['src/foo.ts'][0].approved, true);
  });

  it('clears workspaceState on clear()', () => {
    const state = makeFakeState();
    const tracker = new ChangeTracker(state);
    tracker.setHunks('src/foo.ts', [makeHunk('h1', 'src/foo.ts')]);
    tracker.clear();
    const stored = state._store.get('claudeReview.hunks');
    assert.ok(!stored || Object.keys(stored).length === 0);
  });
});
