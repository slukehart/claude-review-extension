import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { shouldSkipChange, scheduleSkipClear } from './userSaveFilter';

const execAsync = promisify(exec);

const KEY_ACTIVE   = 'claudeReview.isActive';
const KEY_BASELINE = 'claudeReview.baseline';

export class SessionManager {
  private baseline: string | null = null;
  private watcher: vscode.FileSystemWatcher | null = null;
  private saveListener: vscode.Disposable | null = null;
  private _isActive = false;
  private _userSavedFiles: Set<string> = new Set();
  private ctx?: vscode.Memento;

  constructor(ctx?: vscode.Memento) {
    this.ctx = ctx;
    if (ctx) {
      this._isActive = ctx.get<boolean>(KEY_ACTIVE, false);
      this.baseline  = ctx.get<string | null>(KEY_BASELINE, null);
    }
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get sessionBaseline(): string | null {
    return this.baseline;
  }

  isUserSave(fsPath: string): boolean {
    return shouldSkipChange(fsPath, this._userSavedFiles);
  }

  private attachWatcher(
    workspaceRoot: string,
    onFileChange: (filePath: string) => void
  ): void {
    // onWillSaveTextDocument fires before the file is written, ensuring the
    // path is in the skip set before the filesystem watcher can fire.
    this.saveListener = vscode.workspace.onWillSaveTextDocument(e => {
      const fsPath = e.document.uri.fsPath;
      this._userSavedFiles.add(fsPath);
      scheduleSkipClear(fsPath, this._userSavedFiles);
    });

    this.watcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, true);
    this.watcher.onDidChange(uri => onFileChange(uri.fsPath));
    this.watcher.onDidCreate(uri => onFileChange(uri.fsPath));
  }

  /** Re-attach watcher after restoring a persisted session. Does not re-compute baseline. */
  resume(workspaceRoot: string, onFileChange: (filePath: string) => void): void {
    if (!this._isActive || !this.baseline) return;
    this.attachWatcher(workspaceRoot, onFileChange);
  }

  async start(
    workspaceRoot: string,
    onFileChange: (filePath: string) => void
  ): Promise<void> {
    if (this._isActive) return;

    try {
      await execAsync('git rev-parse --git-dir', { cwd: workspaceRoot });
    } catch {
      throw new Error('Claude Review: No git repository found in workspace.');
    }

    const { stdout } = await execAsync('git stash create', { cwd: workspaceRoot });
    const hash = stdout.trim();

    if (!hash) {
      const head = await execAsync('git rev-parse HEAD', { cwd: workspaceRoot });
      this.baseline = head.stdout.trim();
    } else {
      this.baseline = hash;
    }

    this.ctx?.update(KEY_BASELINE, this.baseline);
    this.ctx?.update(KEY_ACTIVE, true);

    this.attachWatcher(workspaceRoot, onFileChange);
    this._isActive = true;
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }
    if (this.saveListener) {
      this.saveListener.dispose();
      this.saveListener = null;
    }
    this._userSavedFiles.clear();
    this.baseline = null;
    this._isActive = false;
    this.ctx?.update(KEY_ACTIVE, false);
    this.ctx?.update(KEY_BASELINE, null);
  }
}
