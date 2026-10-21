// Sample reports and data synced by scripts/sync-samples.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

export const sampleSource = z.object({
  repo: z.enum(['tokvera', 'sievant', 'halotrcer']),
  path: z.string(),
  ref: z.string(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  command: z.string(),
  about: z.string(),
});

export type SampleSource = z.infer<typeof sampleSource>;

const dir = () => join(process.cwd(), 'content', 'samples');

export function sample<T = unknown>(id: string): { data: T; source: SampleSource; raw: string } {
  const source = sampleSource.parse(
    JSON.parse(readFileSync(join(dir(), `${id}.source.json`), 'utf8')),
  );
  const file = join(dir(), `${id}${source.path.slice(source.path.lastIndexOf('.'))}`);
  const raw = readFileSync(file, 'utf8');
  const data = (source.path.endsWith('.json') ? JSON.parse(raw) : parse(raw)) as T;
  return { data, source, raw };
}
