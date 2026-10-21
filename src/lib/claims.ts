// Loads and validates content/claims.yaml. Unknown ids fail the build.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

const repoSource = z.object({
  repo: z.enum(['tokvera', 'sievant', 'halotrcer']),
  path: z.string().min(1),
  lines: z.string().regex(/^\d+(-\d+)?$/),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  quote: z.string().min(1),
});

const ownerSource = z.object({
  owner: z.literal(true),
  decided: z.union([z.string(), z.date()]),
  note: z.string().min(1),
});

export const claimSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
  text: z.string().min(1),
  source: z.union([repoSource, ownerSource]),
});

export type Claim = z.infer<typeof claimSchema>;
export type RepoSource = z.infer<typeof repoSource>;

export function parseClaims(yamlText: string): Map<string, Claim> {
  const list = z.array(claimSchema).parse(parse(yamlText));
  const map = new Map<string, Claim>();
  for (const claim of list) {
    if (map.has(claim.id)) throw new Error(`Duplicate claim id: ${claim.id}`);
    map.set(claim.id, claim);
  }
  return map;
}

let cache: Map<string, Claim> | undefined;

export function loadClaims(root = process.cwd()): Map<string, Claim> {
  cache ??= parseClaims(readFileSync(join(root, 'content', 'claims.yaml'), 'utf8'));
  return cache;
}

export function claim(id: string): Claim {
  const found = loadClaims().get(id);
  if (!found) throw new Error(`Unknown claim id "${id}" (add it to content/claims.yaml)`);
  return found;
}
