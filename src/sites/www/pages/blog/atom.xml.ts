import type { APIRoute } from 'astro';
import { feedItems, posts } from '../../../../lib/blog.ts';
import { atom } from '../../../../lib/feeds.ts';

export const GET: APIRoute = async () =>
  new Response(atom(feedItems(await posts())), {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  });
