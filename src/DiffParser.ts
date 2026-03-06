export interface Hunk {
  id: string;
  filePath: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
  approved: boolean;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseDiff(diffOutput: string, filePath: string): Hunk[] {
  if (!diffOutput.trim()) return [];

  const hunks: Hunk[] = [];
  const lines = diffOutput.split('\n');
  let currentHunk: Hunk | null = null;

  for (const line of lines) {
    const match = HUNK_HEADER.exec(line);
    if (match) {
      if (currentHunk) hunks.push(currentHunk);
      const oldStart = parseInt(match[1], 10);
      const oldCount = match[2] !== undefined ? parseInt(match[2], 10) : 1;
      const newStart = parseInt(match[3], 10);
      const newCount = match[4] !== undefined ? parseInt(match[4], 10) : 1;
      currentHunk = {
        id: `${filePath}:${newStart}`,
        filePath,
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: [],
        approved: false,
      };
    } else if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      currentHunk.lines.push(line);
    }
  }

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}
