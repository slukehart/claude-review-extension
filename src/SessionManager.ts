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
      // No uncommitted changes — use HEAD as baseline
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
