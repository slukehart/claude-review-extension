import { Hunk } from './DiffParser';

export class ChangeTracker {
  private fileHunks: Map<string, Hunk[]> = new Map();

  setHunks(filePath: string, hunks: Hunk[]): void {
    this.fileHunks.set(filePath, hunks);
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
    if (hunk) hunk.approved = true;
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
  }

  hasUnresolved(filePath: string): boolean {
    const hunks = this.fileHunks.get(filePath);
    if (!hunks) return false;
    return hunks.some(h => !h.approved);
  }

  clear(): void {
    this.fileHunks.clear();
  }
}
