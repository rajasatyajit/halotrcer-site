import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Docs synced read-only from the product repos by scripts/sync-docs.ts.
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/docs' }),
  schema: z.object({
    title: z.string(),
    source: z.object({
      repo: z.enum(['tokvera', 'sievant', 'halotrcer']),
      path: z.string(),
      ref: z.string(),
      commit: z.string().regex(/^[0-9a-f]{40}$/),
    }),
    // false: contains install commands, versions or GitHub links; built only when launched
    prelaunch: z.boolean(),
    order: z.number().int(),
  }),
});

// Blog posts (www /blog). Drafts are outlines awaiting the owner: noindex, and
// left out of the sitemap and the feeds. A published post needs a date.
const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/blog' }),
  schema: z
    .object({
      title: z.string().max(70),
      description: z.string().min(50).max(200),
      draft: z.boolean(),
      published: z.coerce.date().optional(),
      updated: z.coerce.date().optional(),
    })
    .refine((p) => p.draft || p.published, 'a published post needs a published date'),
});

export const collections = { docs, blog };
