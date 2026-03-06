import * as vscode from 'vscode';

export class StatusBarController {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'claudeReview.toggleSession';
    this.setInactive();
    this.item.show();
  }

  setActive(): void {
    this.item.text = '$(pulse) Claude Session Active';
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.item.tooltip = 'Click to stop Claude review session';
  }

  setInactive(): void {
    this.item.text = '$(circle-slash) Start Claude Session';
    this.item.backgroundColor = undefined;
    this.item.tooltip = 'Click to start Claude review session';
  }

  dispose(): void {
    this.item.dispose();
  }
}
