// Loads content/pricing.md, the single source for prices and scopes (owner-set).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { SITES } from '../config/site.ts';

// A service has a starting price (from) or a fixed price (price), never both.
const service = z
  .object({
    id: z.string(),
    name: z.string(),
    // The self-select line above the name ("Your bill or latency").
    kicker: z.string(),
    product: z.enum(SITES),
    from: z.number().int().positive().optional(),
    price: z.number().int().positive().optional(),
    duration: z.string(),
    summary: z.string(),
    deliverables: z.array(z.string()).min(1),
  })
  .refine((s) => (s.from === undefined) !== (s.price === undefined), {
    message: 'a service needs exactly one of from or price',
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

// The only way a price is written on the site: "From $3,500" for a starting price, "$3,500"
// for a fixed one ("from $3,500" inside a sentence).
export function priceLabel(s: Service, { inSentence = false } = {}): string {
  if (s.price !== undefined) return formatPrice(s.price);
  if (s.from === undefined) throw new Error(`${s.id} has no price`);
  return `${inSentence ? 'from' : 'From'} ${formatPrice(s.from)}`;
}

// The amount alone, for structured data.
export const amount = (s: Service): number => s.price ?? s.from ?? 0;

export const serviceFor = (id: string) => {
  const s = loadPricing().services.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown service "${id}" in content/pricing.md`);
  return s;
};
