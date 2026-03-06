import * as assert from 'assert';
import * as sinon from 'sinon';
import { buildReversePatch, rejectHunk } from '../src/HunkApplicator';
import { Hunk } from '../src/DiffParser';
import child_process = require('child_process');

function makeHunk(overrides: Partial<Hunk> = {}): Hunk {
  return {
    id: 'src/foo.ts:5',
    filePath: '/workspace/src/foo.ts',
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
