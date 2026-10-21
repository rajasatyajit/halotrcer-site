// Product docs synced from the repos (content/docs/<product>/). A doc is built
// when launched, or before launch when it passed the pre-launch rules at sync.
import { getCollection, type CollectionEntry } from 'astro:content';
import { getFlags } from '../config/flags.ts';
import { PROMOTED } from './doc-links.ts';

export type Doc = CollectionEntry<'docs'>;

export const slugOf = (doc: Doc) => doc.id.split('/').slice(1).join('/');

export async function productDocs(product: 'tokvera' | 'sievant') {
  const { launched } = getFlags();
  const all = (await getCollection('docs', (d) => d.id.startsWith(`${product}/`))).sort(
    (a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title),
  );
  const href = (d: Doc) => PROMOTED[product]?.[slugOf(d)] ?? `/docs/${slugOf(d)}`;
  return {
    // every doc built on this site, in navigation order
    built: all.filter((d) => launched || d.data.prelaunch).map((d) => ({ doc: d, href: href(d) })),
    // docs that wait for the release (they show install commands or versions)
    later: all.filter((d) => !launched && !d.data.prelaunch),
    // docs rendered at /docs/<slug> (promoted ones have their own page)
    routed: all.filter((d) => (launched || d.data.prelaunch) && !PROMOTED[product]?.[slugOf(d)]),
  };
}

// A meta description from the doc's first paragraph of prose.
export function describe(doc: Doc, product: string): string {
  const para = (doc.body ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(#|>|\||```|- |\d+\.|<)/.test(p));
  const text = (para ?? '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const base =
    text.length >= 50 ? text : `${doc.data.title}: ${product} documentation. ${text}`.trim();
  return base.length > 160 ? `${base.slice(0, 157).replace(/\s+\S*$/, '')}…` : base;
}

// The URL of a product doc if it is built on this site, else undefined.
export async function docLink(
  product: 'tokvera' | 'sievant',
  slug: string,
): Promise<string | undefined> {
  const { built } = await productDocs(product);
  return built.find((b) => slugOf(b.doc) === slug)?.href;
}

// A doc's title without Markdown code marks.
export const plainTitle = (doc: Doc) => doc.data.title.replace(/`/g, '');

// For <title>: the plain title, or its part before ":" or "—" when the full
// title plus " · <Product>" would pass 70 characters.
export function pageTitle(doc: Doc): string {
  const t = plainTitle(doc);
  return t.length <= 58 ? t : (t.split(/\s*[:—]\s*/)[0] ?? t);
}
