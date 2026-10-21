// Release data: data/releases/<product>.json (committed fallback, written by
// scripts/sync-releases.ts) or a build-time fetch of each repo's latest release
// (scripts/fetch-releases.ts). RELEASE_DATA_DIR overrides the directory (CI
// uses tests/fixtures/releases for launched-mode builds).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export const PRODUCT_IDS = ['tokvera', 'sievant', 'halotrcer'] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

const os = z.enum(['macos', 'linux', 'windows']);

export const channelSchema = z.object({
  id: z.string(),
  label: z.string(),
  os: z.union([z.array(os), z.literal('any')]),
  commands: z.array(z.string()),
  link: z.string().optional(),
  what: z.string(),
  whatCite: z.string(),
  verify: z
    .object({ text: z.string(), cite: z.string(), commands: z.array(z.string()) })
    .optional(),
});

export const releaseDataSchema = z.object({
  product: z.enum(PRODUCT_IDS),
  name: z.string(),
  binary: z.string(),
  source: z.object({ repo: z.string(), ref: z.string(), commit: z.string() }),
  release: z
    .object({ tag: z.string(), version: z.string(), published: z.string(), url: z.string() })
    .nullable(),
  next: z.array(z.object({ cmd: z.string(), note: z.string().optional() })),
  scripts: z.record(
    z.string(),
    z.object({ path: z.string(), sha256: z.string(), bytes: z.number() }),
  ),
  channels: z.array(channelSchema),
});

export type Channel = z.infer<typeof channelSchema>;
export type ReleaseData = z.infer<typeof releaseDataSchema>;
export type Release = NonNullable<ReleaseData['release']>;

export type Arch = 'x64' | 'arm64';
export type PlatformOs = 'linux' | 'darwin' | 'windows';

export function releaseDir(root = process.cwd()): string {
  // || not ??: CI matrix expressions yield '' for "unset".
  return process.env.RELEASE_DATA_DIR || join(root, 'data', 'releases');
}

export function loadRelease(product: ProductId, dir = releaseDir()): ReleaseData | undefined {
  const file = join(dir, `${product}.json`);
  if (!existsSync(file)) return undefined;
  return releaseDataSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

// Fills a templated command for one release and platform. Throws on a
// placeholder it cannot fill, so a half-resolved command never ships.
export function resolve(
  text: string,
  release: Release,
  platform: { arch: Arch; os?: PlatformOs } = { arch: 'x64' },
): string {
  const goarch = platform.arch === 'arm64' ? 'arm64' : 'amd64';
  const values: Record<string, string> = {
    tag: release.tag,
    version: release.version,
    apkArch: platform.arch === 'arm64' ? 'aarch64' : 'x86_64',
    platform: `${platform.os ?? 'linux'}_${goarch}`,
  };
  return text.replace(/\{(\w+)\}/g, (m, key: string) => {
    const v = values[key];
    if (v === undefined) throw new Error(`Unresolved placeholder ${m} in "${text}"`);
    return v;
  });
}

export const isArchDependent = (c: Channel) =>
  [...c.commands, ...(c.verify?.commands ?? [])].some((t) => /\{(apkArch|platform)\}/.test(t));
