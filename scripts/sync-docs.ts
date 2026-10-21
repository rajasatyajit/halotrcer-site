// Copies product docs into content/docs/<product>/ from the repos (read-only),
// recording the exact commit in each file's frontmatter. Review and commit the result.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { stringify } from 'yaml';
import { resolveRef, showFile, type RepoId } from './lib/repos.ts';

interface Entry {
  repo: RepoId;
  ref: string;
  docs: string[];
}

const config = JSON.parse(readFileSync('config/docs-sync.json', 'utf8')) as Record<
  string,
  Entry | string
>;

for (const [product, entry] of Object.entries(config)) {
  if (typeof entry === 'string') continue; // $comment
  const commit = resolveRef(entry.repo, entry.ref);
  const outDir = join('content', 'docs', product);
  mkdirSync(outDir, { recursive: true });
  for (const path of entry.docs) {
    const raw = showFile(entry.repo, commit, path);
    const h1 = /^#\s+(.+)$/m.exec(raw);
    if (!h1?.[1]) throw new Error(`${entry.repo}:${path} has no H1 title`);
    const body = raw.replace(h1[0], '').replace(/^\s+/, '');
    const fm = stringify({
      title: h1[1].trim(),
      source: { repo: entry.repo, path, ref: entry.ref, commit },
    });
    writeFileSync(join(outDir, basename(path)), `---\n${fm}---\n\n${body}`);
    console.log(`${product}: ${path} @ ${commit.slice(0, 7)}`);
  }
}
