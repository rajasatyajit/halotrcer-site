// Loads content/pricing.md, the single source for prices and scopes (owner-set).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { SITES } from '../config/site.ts';

const service = z.object({
  id: z.string(),
  name: z.string(),
  product: z.enum(SITES),
  from: z.number().int().positive(),
  duration: z.string(),
  summary: z.string(),
  deliverables: z.array(z.string()).min(1),
});

const schema = z.object({
  source: z.literal('owner'),
  decided: z.union([z.string(), z.date()]),
  currency: z.literal('USD'),
  services: z.array(service).min(1),
  founding_offer: z.object({ title: z.string(), text: z.string() }).optional(),
});

export type Pricing = z.infer<typeof schema>;
export type Service = z.infer<typeof service>;

export function parsePricing(md: string): Pricing {
  const fm = /^---\n([\s\S]*?)\n---/.exec(md)?.[1];
  if (!fm) throw new Error('content/pricing.md has no frontmatter');
  return schema.parse(parse(fm));
}

export const loadPricing = (root = process.cwd()) =>
  parsePricing(readFileSync(join(root, 'content', 'pricing.md'), 'utf8'));

export const formatPrice = (usd: number) => `$${usd.toLocaleString('en-US')}`;

export const serviceFor = (id: string) => {
  const s = loadPricing().services.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown service "${id}" in content/pricing.md`);
  return s;
};
