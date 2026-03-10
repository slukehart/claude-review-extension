import * as vscode from 'vscode';
import { Hunk } from './DiffParser';

export class ChangeTracker {
  private fileHunks: Map<string, Hunk[]> = new Map();
  private ctx?: vscode.Memento;

  constructor(ctx?: vscode.Memento) {
    this.ctx = ctx;
    if (ctx) {
      const stored = ctx.get<Record<string, Hunk[]>>('claudeReview.hunks');
      if (stored) {
        for (const [filePath, hunks] of Object.entries(stored)) {
          this.fileHunks.set(filePath, hunks);
        }
      }
    }
  }

  private persist(): void {
    this.ctx?.update('claudeReview.hunks', Object.fromEntries(this.fileHunks));
  }

  setHunks(filePath: string, hunks: Hunk[]): void {
    const existing = this.fileHunks.get(filePath) ?? [];
    const approvedIds = new Set(existing.filter(h => h.approved).map(h => h.id));
    for (const hunk of hunks) {
      if (approvedIds.has(hunk.id)) hunk.approved = true;
    }
    this.fileHunks.set(filePath, hunks);
    this.persist();
  }

  getHunks(filePath: string): Hunk[] | undefined {
    return this.fileHunks.get(filePath);
  }

  getAllFiles(): string[] {
    return Array.from(this.fileHunks.keys());
  }

  approveHunk(filePath: string, hunkId: string): void {
    const hunks = this.fileHunks.get(filePath);
    if (!hunks) return;
    const hunk = hunks.find(h => h.id === hunkId);
    if (hunk) {
      hunk.approved = true;
      this.persist();
    }
  }

  removeHunk(filePath: string, hunkId: string): void {
    const hunks = this.fileHunks.get(filePath);
    if (!hunks) return;
    const filtered = hunks.filter(h => h.id !== hunkId);
    if (filtered.length === 0) {
      this.fileHunks.delete(filePath);
    } else {
      this.fileHunks.set(filePath, filtered);
    }
    this.persist();
  }

  hasUnresolved(filePath: string): boolean {
    const hunks = this.fileHunks.get(filePath);
    if (!hunks) return false;
    return hunks.some(h => !h.approved);
  }

  clear(): void {
    this.fileHunks.clear();
    this.persist();
  }
}
