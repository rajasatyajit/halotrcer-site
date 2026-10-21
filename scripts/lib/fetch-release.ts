// Build-time release fetch: the latest GitHub release of a product, its docs and
// install scripts at that tag, turned into release data. fetchImpl is injectable
// for tests; GITHUB_TOKEN is used when set (needed while the repos are private).
import { PRODUCTS, type ProductSpec, type Source } from '../../config/install-channels.ts';
import type { ProductId, ReleaseData } from '../../src/lib/releases.ts';
import { buildReleaseData } from './release-data.ts';

type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

const API = 'https://api.github.com/repos/rajasatyajit';

function headers(accept: string): Record<string, string> {
  const h: Record<string, string> = { Accept: accept, 'User-Agent': 'halotrcer-site-build' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// Every file the channel spec reads.
export function filesFor(spec: ProductSpec): string[] {
  const files = new Set<string>();
  const add = (s?: Source) => {
    if (!s) return;
    const f = s.kind === 'literal' ? s.file : (s.file ?? spec.docs);
    if (f) files.add(f);
  };
  for (const c of spec.channels) {
    add(c.source);
    add(c.verify?.source);
  }
  return [...files];
}

export async function fetchRelease(
  product: ProductId,
  scriptPaths: Record<string, string>,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<{ data: ReleaseData; scripts: Record<string, Buffer> }> {
  const spec = PRODUCTS[product];
  const get = async (url: string, accept: string) => {
    const res = await fetchImpl(url, {
      headers: headers(accept),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res;
  };
  const latest = (await (
    await get(`${API}/${spec.repo}/releases/latest`, 'application/vnd.github+json')
  ).json()) as {
    tag_name: string;
    published_at: string;
    html_url: string;
  };
  const tag = latest.tag_name;
  if (!/^v\d+\.\d+\.\d+$/.test(tag))
    throw new Error(`${product}: latest release tag "${tag}" is not vX.Y.Z`);
  const raw = async (path: string) =>
    Buffer.from(
      await (
        await get(
          `${API}/${spec.repo}/contents/${path}?ref=${encodeURIComponent(tag)}`,
          'application/vnd.github.raw',
        )
      ).arrayBuffer(),
    );
  const docs = new Map<string, string>();
  for (const f of filesFor(spec)) docs.set(f, (await raw(f)).toString('utf8'));
  const scripts: Record<string, Buffer> = {};
  for (const [name, path] of Object.entries(scriptPaths)) scripts[name] = await raw(path);
  const data = buildReleaseData({
    spec,
    read: (path) => {
      const text = docs.get(path);
      if (text === undefined) throw new Error(`${product}: ${path} was not fetched`);
      return text;
    },
    ref: tag,
    commit: tag,
    release: { tag, version: tag.slice(1), published: latest.published_at, url: latest.html_url },
    scripts: Object.fromEntries(
      Object.entries(scripts).map(([name, content]) => [
        name,
        { path: scriptPaths[name] ?? name, content },
      ]),
    ),
  });
  return { data, scripts };
}
