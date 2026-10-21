// Copies sample reports and data (config/samples.json) into content/samples/,
// read-only, with <id>.source.json recording repo, path, commit and command.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { resolveRef, showFileBytes, type RepoId } from './lib/repos.ts';

interface Sample {
  repo: RepoId;
  ref: string;
  path: string;
  command: string;
  about: string;
}

const config = JSON.parse(readFileSync('config/samples.json', 'utf8')) as Record<
  string,
  Sample | string
>;
mkdirSync(join('content', 'samples'), { recursive: true });
for (const [id, s] of Object.entries(config)) {
  if (typeof s === 'string') continue;
  const commit = resolveRef(s.repo, s.ref);
  writeFileSync(
    join('content', 'samples', `${id}${extname(s.path)}`),
    showFileBytes(s.repo, commit, s.path),
  );
  writeFileSync(
    join('content', 'samples', `${id}.source.json`),
    JSON.stringify(
      { repo: s.repo, path: s.path, ref: s.ref, commit, command: s.command, about: s.about },
      null,
      2,
    ) + '\n',
  );
  console.log(`${id}: ${s.repo}:${s.path} @ ${commit.slice(0, 7)}`);
}
