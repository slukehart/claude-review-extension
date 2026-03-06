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
      arguments: [
        vscode.Uri.file(hunk.filePath),
        { selection: new vscode.Range(hunk.newStart - 1, 0, hunk.newStart - 1, 0) }
      ],
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
