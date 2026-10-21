// RSS 2.0 and Atom feeds for the blog, from published posts (pure, so tested).
import { url } from '../config/site.ts';

export interface FeedItem {
  slug: string;
  title: string;
  description: string;
  published: Date;
  updated?: Date | undefined;
}

export const FEED = {
  title: 'Halotrcer blog',
  description: 'Notes on LLM inference cost and latency, and on MCP agent security.',
  home: url('www', '/blog'),
  rss: url('www', '/blog/rss.xml'),
  atom: url('www', '/blog/atom.xml'),
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const postUrl = (slug: string) => url('www', `/blog/${slug}`);

// The newest date in the feed; a fixed date when the feed is empty, so the
// output is reproducible from the same content.
const EMPTY_FEED_DATE = new Date('2026-10-21T00:00:00Z');
const latest = (items: FeedItem[]) =>
  items.reduce<Date>(
    (d, i) => ((i.updated ?? i.published) > d ? (i.updated ?? i.published) : d),
    items.length ? new Date(0) : EMPTY_FEED_DATE,
  );

export function rss(items: FeedItem[]): string {
  const entries = items.map(
    (i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${postUrl(i.slug)}</link>
      <guid isPermaLink="true">${postUrl(i.slug)}</guid>
      <pubDate>${i.published.toUTCString()}</pubDate>
      <description>${esc(i.description)}</description>
    </item>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(FEED.title)}</title>
    <link>${FEED.home}</link>
    <description>${esc(FEED.description)}</description>
    <language>en</language>
    <lastBuildDate>${latest(items).toUTCString()}</lastBuildDate>
    <atom:link href="${FEED.rss}" rel="self" type="application/rss+xml"/>
${entries.join('\n')}
  </channel>
</rss>
`.replace(/\n\n/g, '\n');
}

export function atom(items: FeedItem[]): string {
  const entries = items.map(
    (i) => `  <entry>
    <title>${esc(i.title)}</title>
    <link href="${postUrl(i.slug)}"/>
    <id>${postUrl(i.slug)}</id>
    <published>${i.published.toISOString()}</published>
    <updated>${(i.updated ?? i.published).toISOString()}</updated>
    <summary>${esc(i.description)}</summary>
  </entry>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(FEED.title)}</title>
  <subtitle>${esc(FEED.description)}</subtitle>
  <link href="${FEED.home}"/>
  <link href="${FEED.atom}" rel="self" type="application/atom+xml"/>
  <id>${FEED.home}</id>
  <updated>${latest(items).toISOString()}</updated>
  <author><name>Halotrcer</name></author>
${entries.join('\n')}
</feed>
`.replace(/\n\n/g, '\n');
}
