// The first Markdown table under a heading in a synced doc, as rows of cells
// (code-span backticks dropped, escaped pipes restored).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function docTable(docId: string, heading: string): { head: string[]; rows: string[][] } {
  const md = readFileSync(join(process.cwd(), 'content', 'docs', `${docId}.md`), 'utf8');
  const lines = md.split('\n');
  const start = lines.findIndex(
    (l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s+/, '').trim() === heading,
  );
  if (start < 0) throw new Error(`${docId}: heading "${heading}" not found`);
  const first = lines.findIndex((l, i) => i > start && l.trim().startsWith('|'));
  const table: string[] = [];
  for (let i = first; i >= 0 && i < lines.length && lines[i]?.trim().startsWith('|'); i++)
    table.push(lines[i] ?? '');
  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\||\|$/g, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replace(/\\\|/g, '|').replace(/`/g, ''));
  const [head = '', , ...rows] = table;
  return { head: cells(head), rows: rows.map(cells) };
}
