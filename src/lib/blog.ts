// Blog posts from content/blog. Feeds (feeds.ts) and the sitemap carry
// published posts only; drafts (outlines) are listed on /blog.
import { getCollection, type CollectionEntry } from 'astro:content';
import type { FeedItem } from './feeds.ts';

export type BlogEntry = CollectionEntry<'blog'>;

// Published posts newest first, then drafts by title.
export async function posts(): Promise<BlogEntry[]> {
  const all = await getCollection('blog');
  const published = all
    .filter((p) => !p.data.draft)
    .sort((a, b) => (b.data.published?.getTime() ?? 0) - (a.data.published?.getTime() ?? 0));
  const drafts = all
    .filter((p) => p.data.draft)
    .sort((a, b) => a.data.title.localeCompare(b.data.title));
  return [...published, ...drafts];
}

export function feedItems(entries: BlogEntry[]): FeedItem[] {
  return entries
    .filter((e) => !e.data.draft && e.data.published)
    .map((e) => ({
      slug: e.id,
      title: e.data.title,
      description: e.data.description,
      published: e.data.published as Date,
      updated: e.data.updated,
    }));
}
