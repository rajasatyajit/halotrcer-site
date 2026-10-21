import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { atom, rss, type FeedItem } from '../../src/lib/feeds.ts';
import { blogPosting } from '../../src/lib/jsonld.ts';
import { SCHEMAS } from '../../scripts/lib/jsonld-schemas.ts';

const item: FeedItem = {
  slug: 'a-post',
  title: 'Tokens & <latency>',
  description: 'A description that is long enough to be a real summary of the post.',
  published: new Date('2026-11-02T00:00:00Z'),
};

describe('feeds', () => {
  it('writes an RSS item per published post, escaped', () => {
    const xml = rss([item]);
    expect(xml).toContain('<title>Tokens &amp; &lt;latency&gt;</title>');
    expect(xml).toContain('<link>https://www.halotrcer.com/blog/a-post</link>');
    expect(xml).toContain('<pubDate>Mon, 02 Nov 2026 00:00:00 GMT</pubDate>');
    expect(xml).toContain('rel="self" type="application/rss+xml"');
    expect(parse(xml, { lowerCaseTagName: false }).querySelectorAll('item')).toHaveLength(1);
  });

  it('writes an Atom entry with published and updated dates', () => {
    const xml = atom([{ ...item, updated: new Date('2026-11-05T00:00:00Z') }]);
    expect(xml).toContain('<id>https://www.halotrcer.com/blog/a-post</id>');
    expect(xml).toContain('<published>2026-11-02T00:00:00.000Z</published>');
    expect(xml).toContain('<updated>2026-11-05T00:00:00.000Z</updated>');
  });

  it('is valid and reproducible with no published posts', () => {
    expect(rss([])).toBe(rss([]));
    expect(rss([])).not.toContain('<item>');
    expect(atom([])).toContain('<updated>2026-10-21T00:00:00.000Z</updated>');
  });
});

describe('BlogPosting JSON-LD', () => {
  it('passes the schema check-jsonld applies', () => {
    const node = blogPosting({ ...item, title: 'A post' });
    expect(() => SCHEMAS.BlogPosting?.parse(node)).not.toThrow();
    expect(node.datePublished).toBe('2026-11-02');
  });
});
