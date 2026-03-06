import cp = require('child_process');
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Hunk } from './DiffParser';

export function buildReversePatch(hunk: Hunk, workspaceRoot: string): string {
  const relPath = path.relative(workspaceRoot, hunk.filePath);
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
    cp.exec(cmd, { cwd: workspaceRoot }, (err, _stdout, stderr) => {
      fs.unlinkSync(tmpFile);
      if (err) {
        reject(new Error(err.message + '\n' + stderr));
      } else {
        resolve();
      }
    });
  });
}
