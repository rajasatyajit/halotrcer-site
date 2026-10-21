// Hero variants per host (content/heroes/<site>.yaml). Each names claim ids, so
// every variant is sourced; only approved variants may be built.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import type { SiteId } from '../config/site.ts';
import { claim, type Claim } from './claims.ts';

const schema = z.object({
  variants: z
    .array(
      z.object({
        id: z.enum(['a', 'b', 'c']),
        title: z.string(),
        lede: z.string(),
        status: z.enum(['approved', 'draft']),
      }),
    )
    .length(3),
});

export interface Hero {
  id: string;
  title: Claim;
  lede: Claim;
}

export function heroVariants(site: SiteId, root = process.cwd()) {
  return schema.parse(parse(readFileSync(join(root, 'content', 'heroes', `${site}.yaml`), 'utf8')))
    .variants;
}

export function hero(site: SiteId, variant = process.env.HERO_VARIANT ?? 'a'): Hero {
  const v = heroVariants(site).find((x) => x.id === variant);
  if (!v) throw new Error(`No hero variant "${variant}" for ${site}`);
  if (v.status !== 'approved') {
    throw new Error(`Hero variant ${site}/${variant} is a draft; the owner must approve it first`);
  }
  return { id: v.id, title: claim(v.title), lede: claim(v.lede) };
}
