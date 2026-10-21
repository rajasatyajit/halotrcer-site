import type { APIRoute } from 'astro';
import { feedItems, posts } from '../../../../lib/blog.ts';
import { rss } from '../../../../lib/feeds.ts';

export const GET: APIRoute = async () =>
  new Response(rss(feedItems(await posts())), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
