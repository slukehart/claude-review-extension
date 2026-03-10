import * as assert from 'assert';
import { shouldSkipChange } from '../src/userSaveFilter';

describe('shouldSkipChange', () => {
  it('returns false when file not in set', () => {
    const set = new Set<string>();
    assert.strictEqual(shouldSkipChange('/a/b.ts', set), false);
  });

  it('returns true when file is in set', () => {
    const set = new Set(['/a/b.ts']);
    assert.strictEqual(shouldSkipChange('/a/b.ts', set), true);
  });

  it('returns true on a second call if entry has not been cleared yet', () => {
    // Simulates filesystem watcher firing twice for one save
    const set = new Set(['/a/b.ts']);
    assert.strictEqual(shouldSkipChange('/a/b.ts', set), true);
    // Entry is still present (cleared via timeout, not immediately)
    assert.strictEqual(shouldSkipChange('/a/b.ts', set), true);
  });

  it('does not affect other files in set', () => {
    const set = new Set(['/a/b.ts', '/a/c.ts']);
    shouldSkipChange('/a/b.ts', set);
    assert.strictEqual(set.has('/a/c.ts'), true);
  });

  it('returns false for a different file not in set', () => {
    const set = new Set(['/a/b.ts']);
    assert.strictEqual(shouldSkipChange('/a/c.ts', set), false);
  });
});
