// Local check (needs the sibling product repos, read-only): every repo-sourced
// claim's quote must still be at the recorded commit, path and lines.
import { existsSync } from 'node:fs';
import { loadClaims } from '../src/lib/claims.ts';
import { Report } from './lib/dist.ts';
import { REPOS, showFile } from './lib/repos.ts';

// Formatting (bold, code spans, blockquote and // comment markers) is ignored; words are not.
const normalize = (s: string) =>
  s
    .replace(/\*\*|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const report = new Report();
let checked = 0;
for (const c of loadClaims().values()) {
  if (!('repo' in c.source)) continue;
  const { repo, path, lines, commit, quote } = c.source;
  if (!existsSync(REPOS[repo])) {
    report.error(
      `${c.id}: repo ${repo} not found at ${REPOS[repo]} (set REPO_${repo.toUpperCase()})`,
    );
    continue;
  }
  let file: string;
  try {
    file = showFile(repo, commit, path);
  } catch {
    report.error(`${c.id}: cannot read ${repo}@${commit.slice(0, 7)}:${path}`);
    continue;
  }
  const [from = 1, to = from] = lines.split('-').map(Number);
  const excerpt = file
    .split('\n')
    .slice(from - 1, to)
    .map((l) => l.replace(/^\s*(>|\/\/)\s?/, ''))
    .join(' ');
  if (!normalize(excerpt).includes(normalize(quote))) {
    report.error(`${c.id}: quote not found at ${repo}:${path}:${lines} (${commit.slice(0, 7)})`);
  }
  checked++;
}
report.finish(`claim sources (${checked} quotes verified)`);
