import * as vscode from 'vscode';
import { ChangeTracker } from './ChangeTracker';

const addedDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(0, 255, 0, 0.12)',
  isWholeLine: true,
});

const approvedDecoration = vscode.window.createTextEditorDecorationType({
  after: { contentText: ' ✓', color: 'rgba(100,200,100,0.8)' },
  isWholeLine: true,
});

export class DecorationProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private readonly tracker: ChangeTracker) {}

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

  applyDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const filePath = editor.document.uri.fsPath;
      const hunks = this.tracker.getHunks(filePath);

      if (!hunks) {
        editor.setDecorations(addedDecoration, []);
        editor.setDecorations(approvedDecoration, []);
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

      editor.setDecorations(addedDecoration, addedRanges);
      editor.setDecorations(approvedDecoration, approvedRanges);
    }
  }
}
