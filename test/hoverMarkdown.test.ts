import * as assert from 'assert';
import { buildHoverMarkdown } from '../src/hoverMarkdown';
import { Hunk } from '../src/DiffParser';

function makeHunk(lines: string[], newCount = 2): Hunk {
  return {
    id: 'test:1',
    filePath: '/a/b.ts',
    oldStart: 1,
    oldCount: 2,
    newStart: 1,
    newCount,
    lines,
    approved: false,
  };
}

describe('buildHoverMarkdown', () => {
  it('passes removed lines through in diff format', () => {
    const hunk = makeHunk(['-old line', '+new line']);
    const md = buildHoverMarkdown(hunk);
    assert.ok(md.includes('-old line'), `expected "-old line" in:\n${md}`);
  });

  it('passes added lines through in diff format', () => {
    const hunk = makeHunk(['-old line', '+new line']);
    const md = buildHoverMarkdown(hunk);
    assert.ok(md.includes('+new line'), `expected "+new line" in:\n${md}`);
  });

  it('mixed hunk shows both removed and added lines, excludes context', () => {
    const hunk = makeHunk([' context', '-removed', '+added']);
    const md = buildHoverMarkdown(hunk);
    assert.ok(md.includes('-removed'));
    assert.ok(md.includes('+added'));
    assert.ok(!md.includes(' context'), `context lines should not appear in:\n${md}`);
  });

  it('pure deletion (newCount === 0) adds removal note', () => {
    const hunk = makeHunk(['-only removed'], 0);
    const md = buildHoverMarkdown(hunk);
    assert.ok(md.includes('-only removed'));
    assert.ok(md.includes('lines removed'));
  });

  it('pure addition (no - lines) does not add removal note', () => {
    const hunk = makeHunk(['+only added']);
    const md = buildHoverMarkdown(hunk);
    assert.ok(md.includes('+only added'));
    assert.ok(!md.includes('lines removed'));
  });

  it('empty lines array returns a fenced diff block without throwing', () => {
    const hunk = makeHunk([]);
    const md = buildHoverMarkdown(hunk);
    assert.ok(md.includes('```diff'));
  });
});
