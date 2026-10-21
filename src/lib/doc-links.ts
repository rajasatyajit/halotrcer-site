// Markdown (hast) plugin for docs synced from the product repos (content/docs/<product>/).
// Relative links are written for GitHub; on the site they become:
//   another synced doc            -> /docs/<slug> (or its promoted page, e.g. /scoring)
//   any other repo file           -> GitHub at the synced commit (launched only)
//   anything else before launch   -> plain text (the repos are private)
// Images become links to the asset, so screenshots never weigh down a docs page.
// Raw HTML is shown as text: the docs are Markdown, and markup never passes through.
// Headings never skip a level, and scrollable tables and code are focusable.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { satteri } from '@astrojs/markdown-satteri';
import { parse } from 'yaml';

// Docs with a dedicated page instead of /docs/<slug>.
export const PROMOTED: Record<string, Record<string, string>> = {
  tokvera: { scoring: '/scoring', faq: '/faq' },
  sievant: { 'owasp-llm-mapping': '/owasp-llm-top-10', faq: '/faq' },
};

const docsDir = () => join(process.cwd(), 'content', 'docs');
const prelaunchCache = new Map<string, boolean>();

function docAvailable(product: string, slug: string, launched: boolean): boolean {
  const file = join(docsDir(), product, `${slug}.md`);
  if (!existsSync(file)) return false;
  if (launched) return true;
  const key = `${product}/${slug}`;
  if (!prelaunchCache.has(key)) {
    const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
    prelaunchCache.set(key, (parse(fm) as { prelaunch?: boolean }).prelaunch === true);
  }
  return prelaunchCache.get(key) === true;
}

export function docHref(opts: {
  href: string;
  product: string;
  docPath: string; // the doc's path in its repo, e.g. docs/scan.md
  repo: string;
  commit: string;
  launched: boolean;
}): string | undefined {
  const { href, product, docPath, repo, commit, launched } = opts;
  if (/^([a-z]+:|#|\/)/i.test(href)) return href;
  const [rawPath = '', hash = ''] = href.split('#');
  const target = posix.normalize(posix.join(posix.dirname(docPath), rawPath));
  const fragment = hash ? `#${hash}` : '';
  const m = /^docs\/([\w-]+)\.md$/.exec(target);
  if (m?.[1] && docAvailable(product, m[1], launched)) {
    return `${PROMOTED[product]?.[m[1]] ?? `/docs/${m[1]}`}${fragment}`;
  }
  if (launched)
    return `https://github.com/rajasatyajit/${repo}/blob/${commit}/${target}${fragment}`;
  return undefined;
}

type HastPlugins = NonNullable<NonNullable<Parameters<typeof satteri>[0]>['hastPlugins']>;
type Element = { tagName: string; properties?: Record<string, unknown>; children?: unknown[] };

// Sätteri (Astro's Markdown processor) hast plugin. The factory runs per
// document and returns nothing for files that aren't synced docs.
export function docLinksPlugin(options: { launched: boolean }): HastPlugins[number] {
  return (ctx) => {
    const path = ctx.fileURL ? fileURLToPath(ctx.fileURL) : '';
    const rel = path.split(`${join('content', 'docs')}/`)[1];
    if (!rel) return null;
    const product = dirname(rel);
    const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, 'utf8'))?.[1] ?? '';
    const source = (parse(fm) as { source?: { repo?: string; commit?: string; path?: string } })
      .source;
    if (!source?.repo || !source.commit || !source.path) return null;
    const { repo, commit, path: docPath } = source;
    // The page's own <h1> comes first; doc headings may not skip a level after it.
    let previousLevel = 1;
    return {
      name: 'halotrcer-doc-links',
      // Raw HTML in a synced doc is shown as text, never emitted as markup.
      raw(node, c) {
        c.replaceNode(node, {
          type: 'text',
          value: (node as unknown as { value: string }).value,
        } as never);
      },
      element: [
        {
          filter: ['a'],
          visit(node, c) {
            const el = node as unknown as Element;
            const href = el.properties?.href;
            if (typeof href !== 'string') return;
            const next = docHref({
              href,
              product,
              docPath,
              repo,
              commit,
              launched: options.launched,
            });
            if (next === undefined) c.replaceNode(node, (el.children ?? []) as never);
            else if (next !== href) c.setProperty(node, 'href', next);
          },
        },
        {
          // Wide tables and long code scroll sideways: keyboard users must reach them.
          filter: ['table', 'pre'],
          visit(node, c) {
            c.setProperty(node, 'tabIndex', 0);
          },
        },
        {
          filter: ['h2', 'h3', 'h4', 'h5', 'h6'],
          visit(node, c) {
            const el = node as unknown as Element;
            const level = Number(el.tagName.slice(1));
            const clamped = Math.min(level, previousLevel + 1);
            previousLevel = clamped;
            if (clamped !== level) c.replaceNode(node, { ...el, tagName: `h${clamped}` } as never);
          },
        },
        {
          filter: ['img'],
          visit(node, c) {
            const el = node as unknown as Element;
            c.replaceNode(node, {
              type: 'element',
              tagName: 'a',
              properties: { href: `/docs/assets/${basename(String(el.properties?.src ?? ''))}` },
              children: [
                { type: 'text', value: `Screenshot: ${String(el.properties?.alt ?? 'image')}` },
              ],
            } as never);
          },
        },
      ],
    };
  };
}
