// Build-time flags. Parsed once from the environment; a bad value fails the build.
import { z } from 'zod';
import { SITES, type SiteId } from './site.ts';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  SITE_ID: z.enum(SITES),
  LAUNCHED: bool,
  INSTALL_ENDPOINTS: bool,
  ANALYTICS: bool,
});

export interface Flags {
  site: SiteId;
  launched: boolean;
  installEndpoints: boolean;
  analytics: boolean;
}

export function parseFlags(env: Record<string, string | undefined>): Flags {
  const result = schema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid build flags: ${issues}`);
  }
  const f = result.data;
  return {
    site: f.SITE_ID,
    launched: f.LAUNCHED,
    installEndpoints: f.INSTALL_ENDPOINTS,
    analytics: f.ANALYTICS,
  };
}

let cached: Flags | undefined;

export function getFlags(): Flags {
  cached ??= parseFlags(process.env);
  return cached;
}
