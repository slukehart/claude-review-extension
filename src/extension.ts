import * as vscode from 'vscode';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { SessionManager } from './SessionManager';
import { ChangeTracker } from './ChangeTracker';
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

  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => decorations.applyDecorations())
  );

  async function handleFileChange(fsPath: string): Promise<void> {
    if (!workspaceRoot || !session.isActive || !session.sessionBaseline) return;

    const relPath = path.relative(workspaceRoot, fsPath);
    if (relPath.startsWith('.git')) return;

    try {
      const result = spawnSync(
        'git',
        ['diff', session.sessionBaseline!, '--', relPath],
        { cwd: workspaceRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      );
      if (result.error || result.status !== 0) return;
      const diff = result.stdout;

      const hunks = parseDiff(diff, fsPath);
      tracker.setHunks(fsPath, hunks);

      sidebar.refresh();
      decorations.refresh();
    } catch {
      // Binary file or outside git — ignore
    }
  }

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
          vscode.window.showInformationMessage("Claude review session started. Claude's changes will appear here for review.");
        } catch (err: unknown) {
          vscode.window.showErrorMessage((err as Error).message);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeReview.approveHunk', (filePath: string, hunkId: string) => {
      tracker.approveHunk(filePath, hunkId);
      sidebar.refresh();
      decorations.refresh();
    })
  );

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
      } catch (err: unknown) {
        vscode.window.showErrorMessage(`Failed to reject hunk: ${(err as Error).message}`);
      }
    })
  );

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

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeReview.rejectAllInFile', async (filePath: string) => {
      if (!workspaceRoot) return;
      const hunks = [...(tracker.getHunks(filePath) ?? [])];
      for (const hunk of hunks) {
        try {
          await rejectHunk(hunk, workspaceRoot);
          tracker.removeHunk(filePath, hunk.id);
        } catch (err: unknown) {
          vscode.window.showErrorMessage(`Failed to reject hunk: ${(err as Error).message}`);
        }
      }
      sidebar.refresh();
      decorations.refresh();
    })
  );

  context.subscriptions.push(statusBar);
}

export function deactivate(): void {}
