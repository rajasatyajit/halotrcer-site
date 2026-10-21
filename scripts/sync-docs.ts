// Copies product docs into content/docs/<product>/ from the repos (read-only),
// recording the exact commit in each file's frontmatter, plus:
//   prelaunch: whether the doc passes the pre-launch rules (no install
//              commands, versions or GitHub links); others build only when launched
//   order:     position in the docs navigation
// Images a doc references are copied to content/docs/<product>/assets/ and
// replaced by links to /docs/assets/<file>.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, posix } from 'node:path';
import { stringify } from 'yaml';
import { FORBIDDEN } from './lib/rules.ts';
import { listFiles, resolveRef, showFile, showFileBytes, type RepoId } from './lib/repos.ts';

interface Entry {
  repo: RepoId;
  ref: string;
  docs?: string[];
  dir?: string;
  exclude?: string[];
  order?: string[];
}

export const passesPrelaunch = (text: string) => FORBIDDEN.every(([re]) => !re.test(text));

const config = JSON.parse(readFileSync('config/docs-sync.json', 'utf8')) as Record<
  string,
  Entry | string
>;

for (const [product, entry] of Object.entries(config)) {
  if (typeof entry === 'string') continue; // $comment
  const commit = resolveRef(entry.repo, entry.ref);
  const outDir = join('content', 'docs', product);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const paths =
    entry.docs ??
    listFiles(entry.repo, commit, entry.dir ?? 'docs').filter(
      (p) => p.endsWith('.md') && !(entry.exclude ?? []).includes(basename(p)),
    );
  let excluded = 0;
  for (const path of paths) {
    const raw = showFile(entry.repo, commit, path);
    const h1 = /^#\s+(.+)$/m.exec(raw);
    if (!h1?.[1]) throw new Error(`${entry.repo}:${path} has no H1 title`);
    // Images are copied and become links to the copy (docs pages stay light,
    // and Astro's image pipeline never sees repo-relative paths).
    const body = raw
      .replace(h1[0], '')
      .replace(/^\s+/, '')
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, alt: string, src: string) => {
        if (/^[a-z]+:/i.test(src)) return whole;
        const file = posix.normalize(posix.join(dirname(path), src));
        mkdirSync(join(outDir, 'assets'), { recursive: true });
        writeFileSync(
          join(outDir, 'assets', basename(file)),
          showFileBytes(entry.repo, commit, file),
        );
        return `[Screenshot: ${alt || basename(file)}](/docs/assets/${basename(file)})`;
      });
    const slug = basename(path, '.md');
    const order = entry.order?.indexOf(slug) ?? -1;
    const prelaunch = passesPrelaunch(raw);
    if (!prelaunch) excluded++;
    const fm = stringify({
      title: h1[1].trim(),
      source: { repo: entry.repo, path, ref: entry.ref, commit },
      prelaunch,
      order: order < 0 ? 999 : order,
    });
    writeFileSync(join(outDir, basename(path)), `---\n${fm}---\n\n${body}`);
  }
  console.log(
    `${product}: ${paths.length} docs @ ${commit.slice(0, 7)} (${excluded} only when launched)`,
  );
}
