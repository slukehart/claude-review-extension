import * as vscode from 'vscode';
import { ChangeTracker } from './ChangeTracker';
import { Hunk } from './DiffParser';
import { buildHoverMarkdown } from './hoverMarkdown';

export class DecorationProvider implements vscode.CodeLensProvider, vscode.HoverProvider, vscode.Disposable {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private readonly addedDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(0, 255, 0, 0.12)',
    isWholeLine: true,
  });

  private readonly approvedDecoration = vscode.window.createTextEditorDecorationType({
    after: { contentText: ' ✓', color: 'rgba(100,200,100,0.8)' },
    isWholeLine: true,
  });

  constructor(private readonly tracker: ChangeTracker) {}

  dispose(): void {
    this.addedDecoration.dispose();
    this.approvedDecoration.dispose();
    this._onDidChangeCodeLenses.dispose();
  }

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
    this.applyDecorations();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const filePath = document.uri.fsPath;
    const hunks = this.tracker.getHunks(filePath);
    if (!hunks) return [];

    return hunks.flatMap(hunk => {
      const line = Math.max(0, hunk.newStart - 1);
      const range = new vscode.Range(line, 0, line, 0);

      if (hunk.approved) {
        return [new vscode.CodeLens(range, { title: '✓ Approved', command: '' })];
      }

      return [
        new vscode.CodeLens(range, {
          title: '✓ Approve',
          command: 'claudeReview.approveHunk',
          arguments: [filePath, hunk.id],
        }),
        new vscode.CodeLens(range, {
          title: '✗ Reject',
          command: 'claudeReview.rejectHunk',
          arguments: [filePath, hunk.id],
        }),
      ];
    });
  }

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
    const filePath = document.uri.fsPath;
    const hunks = this.tracker.getHunks(filePath);
    if (!hunks) return null;

    const hunk = this.findHunkAtLine(hunks, position.line + 1);
    if (!hunk) return null;

    const md = new vscode.MarkdownString(buildHoverMarkdown(hunk));
    md.isTrusted = true;
    return new vscode.Hover(md);
  }

  private findHunkAtLine(hunks: Hunk[], oneBased: number): Hunk | undefined {
    for (const hunk of hunks) {
      if (hunk.newCount === 0) {
        // Pure deletion: match the insertion-point line
        if (oneBased === hunk.newStart) return hunk;
      } else {
        const end = hunk.newStart + hunk.newCount - 1;
        if (oneBased >= hunk.newStart && oneBased <= end) return hunk;
      }
    }
    return undefined;
  }

  applyDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const filePath = editor.document.uri.fsPath;
      const hunks = this.tracker.getHunks(filePath);

      if (!hunks) {
        editor.setDecorations(this.addedDecoration, []);
        editor.setDecorations(this.approvedDecoration, []);
        continue;
      }

      const addedRanges: vscode.Range[] = [];
      const approvedRanges: vscode.Range[] = [];

      for (const hunk of hunks) {
        let lineOffset = hunk.newStart - 1;
        for (const line of hunk.lines) {
          if (line.startsWith('+')) {
            const range = new vscode.Range(lineOffset, 0, lineOffset, 0);
            if (hunk.approved) {
              approvedRanges.push(range);
            } else {
              addedRanges.push(range);
            }
            lineOffset++;
          } else if (line.startsWith(' ')) {
            lineOffset++;
          }
        }
      }

      editor.setDecorations(this.addedDecoration, addedRanges);
      editor.setDecorations(this.approvedDecoration, approvedRanges);
    }
  }
}
