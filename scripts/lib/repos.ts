// Read-only access to the sibling product repos. Only `git rev-parse` and
// `git show` are ever run against them: neither changes a repository.
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type RepoId = 'tokvera' | 'sievant' | 'halotrcer';

export const REPOS: Record<RepoId, string> = {
  tokvera: process.env.REPO_TOKVERA ?? join(homedir(), 'workspace', 'tokvera'),
  sievant: process.env.REPO_SIEVANT ?? join(homedir(), 'workspace', 'aethergate'),
  halotrcer: process.env.REPO_HALOTRCER ?? join(homedir(), 'workspace', 'halotrcer-installer'),
};

function git(repo: RepoId, args: string[]): string {
  return execFileSync('git', ['-C', REPOS[repo], ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
}

export const resolveRef = (repo: RepoId, ref: string) =>
  git(repo, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();

export const showFile = (repo: RepoId, commit: string, path: string) =>
  git(repo, ['show', `${commit}:${path}`]);

// Raw bytes, for files that must be served byte for byte (install scripts).
export const showFileBytes = (repo: RepoId, commit: string, path: string): Buffer =>
  execFileSync('git', ['-C', REPOS[repo], 'show', `${commit}:${path}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
