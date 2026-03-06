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
    assert.ok(firstHunkLines.some((l: string) => l.startsWith('-')));
    assert.ok(firstHunkLines.some((l: string) => l.startsWith('+')));
  });
});
