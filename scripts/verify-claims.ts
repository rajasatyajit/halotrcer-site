// Local check (needs the sibling product repos, read-only): every repo-sourced
// claim's quote must still be at the recorded commit, path and lines.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadClaims } from '../src/lib/claims.ts';
import { Report } from './lib/dist.ts';

const REPOS = {
  tokvera: process.env.REPO_TOKVERA ?? join(homedir(), 'workspace', 'tokvera'),
  sievant: process.env.REPO_SIEVANT ?? join(homedir(), 'workspace', 'aethergate'),
  halotrcer: process.env.REPO_HALOTRCER ?? join(homedir(), 'workspace', 'halotrcer-installer'),
};

export const normalize = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

const report = new Report();
let checked = 0;
for (const c of loadClaims().values()) {
  if (!('repo' in c.source)) continue;
  const { repo, path, lines, commit, quote } = c.source;
  const dir = REPOS[repo];
  if (!existsSync(dir)) {
    report.error(`${c.id}: repo ${repo} not found at ${dir} (set REPO_${repo.toUpperCase()})`);
    continue;
  }
  let file: string;
  try {
    // Read-only: git show never changes the product repo.
    file = execFileSync('git', ['-C', dir, 'show', `${commit}:${path}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    report.error(`${c.id}: cannot read ${repo}@${commit.slice(0, 7)}:${path}`);
    continue;
  }
  const [from = 1, to = from] = lines.split('-').map(Number);
  const excerpt = file
    .split('\n')
    .slice(from - 1, to)
    .join(' ');
  if (!normalize(excerpt).includes(normalize(quote))) {
    report.error(`${c.id}: quote not found at ${repo}:${path}:${lines} (${commit.slice(0, 7)})`);
  }
  checked++;
}
report.finish(`claim sources (${checked} quotes verified)`);
