import { describe, expect, it } from 'vitest';
import { codeBlocks, commands, inlineCode, templatize } from '../../scripts/lib/install-docs.ts';
import { resolve } from '../../src/lib/releases.ts';

const md = [
  '# Installing x',
  '| Linux | `curl -fsSL https://x.example/install.sh \\| sh` |',
  '## Packages',
  '```sh',
  '# Debian, Ubuntu',
  'sudo apt install ./x_0.2.0_amd64.deb',
  '```',
  '```sh',
  'wget -O /etc/apk/keys/k.pub \\',
  '  https://example/k.pub',
  'apk add ./x_0.2.0_x86_64.apk',
  '```',
  '### Repos',
  '```sh',
  'echo "deb stable main" |',
  '  sudo tee /etc/apt/sources.list.d/x.list',
  'sudo apt update && sudo apt install x',
  '```',
  '## Other',
  '```sh',
  'cosign verify x:v0.2.0',
  'helm install x oci://x --version 0.2.0 \\',
  '  --namespace x',
  '```',
].join('\n');

describe('install doc extraction', () => {
  it('reads inline code and unescapes table pipes', () => {
    expect(inlineCode(md, 'curl -fsSL')).toBe('curl -fsSL https://x.example/install.sh | sh');
  });
  it('ignores "#" comment lines inside fences when finding headings', () => {
    expect(codeBlocks(md, 'Packages')).toHaveLength(3); // two of its own + one in "Repos"
    expect(() => codeBlocks(md, 'Debian, Ubuntu')).toThrow();
  });
  it('joins backslash and pipe continuations into one command', () => {
    const [, apk, repos] = codeBlocks(md, 'Packages');
    expect(commands(apk ?? [])).toEqual([
      'wget -O /etc/apk/keys/k.pub \\\n  https://example/k.pub',
      'apk add ./x_0.2.0_x86_64.apk',
    ]);
    expect(commands(repos ?? [])[0]).toBe(
      'echo "deb stable main" |\n  sudo tee /etc/apt/sources.list.d/x.list',
    );
  });
  it('filters with from and keep', () => {
    const [block] = codeBlocks(md, 'Other');
    expect(commands(block ?? [], { from: /^helm/ })).toEqual([
      'helm install x oci://x --version 0.2.0 \\\n  --namespace x',
    ]);
    expect(commands(block ?? [], { keep: /^cosign/ })).toEqual(['cosign verify x:v0.2.0']);
  });
  it('templatizes the example version, including inside file names', () => {
    expect(templatize('apk add ./x_0.2.0_x86_64.apk', '0.2.0', { x86_64: 'apkArch' })).toBe(
      'apk add ./x_{version}_{apkArch}.apk',
    );
    expect(templatize('cosign verify x:v0.2.0 --version 0.2.0', '0.2.0')).toBe(
      'cosign verify x:{tag} --version {version}',
    );
    expect(templatize('go 1.26+ and 10.2.0.1', '0.2.0')).toBe('go 1.26+ and 10.2.0.1');
  });
});

describe('resolve()', () => {
  const release = { tag: 'v1.4.0', version: '1.4.0', published: '2026-11-01', url: 'u' };
  it('fills version and arch placeholders', () => {
    expect(resolve('apk add ./x_{version}_{apkArch}.apk', release, { arch: 'arm64' })).toBe(
      'apk add ./x_1.4.0_aarch64.apk',
    );
    expect(
      resolve('x_{version}_airgap_{platform}.tar.gz', release, { arch: 'x64', os: 'darwin' }),
    ).toBe('x_1.4.0_airgap_darwin_amd64.tar.gz');
  });
  it('refuses unknown placeholders', () => {
    expect(() => resolve('x {nope}', release)).toThrow(/Unresolved/);
  });
});
