import { Hunk } from './DiffParser';

export function buildHoverMarkdown(hunk: Hunk): string {
  const removed = hunk.lines.filter(l => l.startsWith('-'));
  const added   = hunk.lines.filter(l => l.startsWith('+'));

  const diffLines = [...removed, ...added].join('\n');
  const isPureDeletion = hunk.newCount === 0;
  const note = isPureDeletion ? '\n\n*(lines removed at this position)*' : '';

  return `\`\`\`diff\n${diffLines}\n\`\`\`${note}`;
}
