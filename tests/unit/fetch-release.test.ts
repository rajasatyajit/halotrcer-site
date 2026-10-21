// The build-time fetch, against a fake GitHub that serves files from the local
// product repos (read-only) as if a release tag pointed at the pinned commit.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fetchRelease, filesFor } from '../../scripts/lib/fetch-release.ts';
import { resolveRef, showFileBytes } from '../../scripts/lib/repos.ts';
import { PRODUCTS } from '../../config/install-channels.ts';

const refs = JSON.parse(readFileSync('config/release-refs.json', 'utf8')) as Record<
  string,
  { ref: string; scripts: Record<string, string> }
>;
const local = (() => {
  try {
    resolveRef('sievant', refs.sievant?.ref ?? 'HEAD');
    return true;
  } catch {
    return false;
  }
})();

function fakeGitHub(product: 'tokvera' | 'sievant' | 'halotrcer', tag: string) {
  const commit = resolveRef(PRODUCTS[product].repo, refs[product]?.ref ?? 'HEAD');
  const seen: string[] = [];
  const impl = async (url: string) => {
    seen.push(url);
    const ok = (body: unknown) => ({
      ok: true,
      status: 200,
      json: async () => body,
      arrayBuffer: async () => {
        const b = body as Buffer;
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
      },
    });
    if (url.endsWith('/releases/latest')) {
      return ok({
        tag_name: tag,
        published_at: '2026-11-02T10:00:00Z',
        html_url: `https://github.com/x/releases/tag/${tag}`,
      });
    }
    const m = /\/contents\/(.+)\?ref=(.+)$/.exec(url);
    if (m?.[1] && decodeURIComponent(m[2] ?? '') === tag)
      return ok(showFileBytes(PRODUCTS[product].repo, commit, m[1]));
    return {
      ok: false,
      status: 404,
      json: async () => ({}),
      arrayBuffer: async () => new ArrayBuffer(0),
    };
  };
  return { impl, seen };
}

describe.skipIf(!local)('build-time release fetch', () => {
  it('builds release data at the latest tag, with scripts', async () => {
    const { impl, seen } = fakeGitHub('sievant', 'v1.4.0');
    const { data, scripts } = await fetchRelease('sievant', refs.sievant?.scripts ?? {}, impl);
    expect(data.release?.tag).toBe('v1.4.0');
    expect(data.channels.map((c) => c.id)).toContain('airgap');
    expect(Object.keys(scripts).sort()).toEqual(['install.ps1', 'install.sh']);
    expect(
      seen.every((u) => u.startsWith('https://api.github.com/repos/rajasatyajit/sievant')),
    ).toBe(true);
  });
  it('fetches every file the channel spec reads', () => {
    expect(filesFor(PRODUCTS.tokvera).sort()).toEqual(['docs/helm.md', 'docs/install.md']);
    expect(filesFor(PRODUCTS.halotrcer)).toEqual(['internal/install/channels.go']);
  });
  it('rejects a latest tag that is not vX.Y.Z', async () => {
    const { impl } = fakeGitHub('tokvera', 'nightly');
    await expect(fetchRelease('tokvera', {}, impl)).rejects.toThrow(/not vX.Y.Z/);
  });
});
