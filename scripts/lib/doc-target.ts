// Where a synced doc lands: its lowercased file name is both the content file and the slug,
// so a repo-root SECURITY.md becomes /docs/security.
import { basename } from 'node:path';

export function docTarget(path: string): { slug: string; file: string } {
  const slug = basename(path, '.md').toLowerCase();
  return { slug, file: `${slug}.md` };
}
