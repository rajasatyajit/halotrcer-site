import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { endpointsFor } from '../../integrations/endpoints.ts';
import { parseFlags } from '../../src/config/flags.ts';

// A throwaway project root with one product's release data, refs and vendored script.
function project(opts: {
  status: 'candidate' | 'rc';
  release: boolean;
  scriptBody?: string;
  sha?: string;
}) {
  const root = mkdtempSync(join(tmpdir(), 'endpoints-'));
  mkdirSync(join(root, 'config'));
  mkdirSync(join(root, 'data', 'releases'), { recursive: true });
  mkdirSync(join(root, 'vendor', 'install', 'tokvera'), { recursive: true });
  const body = opts.scriptBody ?? '#!/bin/sh\necho hi\n';
  writeFileSync(join(root, 'vendor', 'install', 'tokvera', 'install.sh'), body);
  writeFileSync(
    join(root, 'config', 'release-refs.json'),
    JSON.stringify({
      tokvera: { ref: 'abc', status: opts.status, scripts: { 'install.sh': 'scripts/install.sh' } },
    }),
  );
  const data = {
    product: 'tokvera',
    name: 'Tokvera',
    binary: 'tokvera',
    source: { repo: 'tokvera', ref: 'abc', commit: 'abc' },
    release: opts.release ? { tag: 'v1.0.0', version: '1.0.0', published: 'p', url: 'u' } : null,
    next: [],
    scripts: {
      'install.sh': {
        path: 'scripts/install.sh',
        // Placeholder: tests that reach the hash check pass the real one.
        sha256: opts.sha ?? '0'.repeat(64),
        bytes: body.length,
      },
    },
    channels: [],
  };
  writeFileSync(join(root, 'data', 'releases', 'tokvera.json'), JSON.stringify(data));
  process.env.RELEASE_DATA_DIR = join(root, 'data', 'releases');
  return root;
}

const realSha = (s: string) =>
  import('node:crypto').then((c) => c.createHash('sha256').update(s).digest('hex'));

afterEach(() => {
  delete process.env.RELEASE_DATA_DIR;
  delete process.env.ALLOW_CANDIDATE_SCRIPTS;
});

describe('install endpoints', () => {
  it('serve nothing before launch unless INSTALL_ENDPOINTS is set', () => {
    const root = project({ status: 'rc', release: false });
    expect(endpointsFor(parseFlags({ SITE_ID: 'tokvera' }), root)).toEqual([]);
  });
  it('refuse a candidate ref (owner decision: pin the RC commit)', () => {
    const root = project({ status: 'candidate', release: false });
    expect(() =>
      endpointsFor(parseFlags({ SITE_ID: 'tokvera', INSTALL_ENDPOINTS: 'true' }), root),
    ).toThrow(/candidate/);
  });
  it('serve the pinned script when its bytes match the recorded SHA-256', async () => {
    const sha = await realSha('#!/bin/sh\necho hi\n');
    const root = project({ status: 'rc', release: false, sha });
    const [e] = endpointsFor(parseFlags({ SITE_ID: 'tokvera', INSTALL_ENDPOINTS: 'true' }), root);
    expect(e?.name).toBe('install.sh');
    expect(e?.sha256).toBe(sha);
  });
  it('fail the build when the bytes differ', () => {
    const root = project({ status: 'rc', release: false, sha: '0'.repeat(64) });
    expect(() =>
      endpointsFor(parseFlags({ SITE_ID: 'tokvera', INSTALL_ENDPOINTS: 'true' }), root),
    ).toThrow(/differ/);
  });
  it('serve nothing when launched without a release for the product', () => {
    const root = project({ status: 'candidate', release: false });
    expect(endpointsFor(parseFlags({ SITE_ID: 'tokvera', LAUNCHED: 'true' }), root)).toEqual([]);
  });
  it('www serves nothing while the bundle has no scripts', () => {
    const root = project({ status: 'rc', release: true });
    writeFileSync(
      join(root, 'data', 'releases', 'halotrcer.json'),
      JSON.stringify({
        product: 'halotrcer',
        name: 'Halotrcer',
        binary: 'halotrcer',
        source: { repo: 'halotrcer', ref: 'a', commit: 'a' },
        release: null,
        next: [],
        scripts: {},
        channels: [],
      }),
    );
    expect(endpointsFor(parseFlags({ SITE_ID: 'www', INSTALL_ENDPOINTS: 'true' }), root)).toEqual(
      [],
    );
  });
});
