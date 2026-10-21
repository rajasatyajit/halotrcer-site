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
  }),
});

export const collections = { docs };
