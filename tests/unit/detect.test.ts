import { describe, expect, it } from 'vitest';
import {
  archFromHints,
  defaultChannel,
  detect,
  fromUserAgent,
  parseHash,
} from '../../src/islands/install/detect.ts';

export const UA = {
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  winChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  winArm:
    'Mozilla/5.0 (Windows NT 10.0; ARM64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0',
  linuxArm: 'Mozilla/5.0 (X11; Linux aarch64; rv:142.0) Gecko/20100101 Firefox/142.0',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  chromeos:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

describe('fromUserAgent', () => {
  it.each([
    ['macSafari', 'macos', undefined, false],
    ['winChrome', 'windows', 'x64', false],
    ['winArm', 'windows', 'arm64', false],
    ['linuxFirefox', 'linux', 'x64', false],
    ['linuxArm', 'linux', 'arm64', false],
    ['iphone', 'ios', undefined, true],
    ['android', 'android', undefined, true],
    ['chromeos', 'linux', 'x64', false],
  ] as const)('%s -> %s %s', (key, os, arch, mobile) => {
    const p = fromUserAgent(UA[key]);
    expect(p.os).toBe(os);
    expect(p.arch).toBe(arch);
    expect(p.mobile).toBe(mobile);
  });
  it('treats a touch-screen "Mac" as an iPad', () => {
    expect(fromUserAgent(UA.macSafari, 5).os).toBe('ios');
  });
});

describe('detect', () => {
  it('prefers userAgentData and high-entropy arch hints', async () => {
    const p = await detect({
      userAgent: UA.macSafari,
      userAgentData: {
        platform: 'macOS',
        mobile: false,
        getHighEntropyValues: async () => ({ architecture: 'arm', bitness: '64' }),
      },
    });
    expect(p).toEqual({ os: 'macos', arch: 'arm64', mobile: false });
  });
  it('falls back to the user agent when hints are refused', async () => {
    const p = await detect({
      userAgent: UA.linuxArm,
      userAgentData: {
        platform: 'Linux',
        getHighEntropyValues: async () => {
          throw new Error('denied');
        },
      },
    });
    expect(p).toEqual({ os: 'linux', arch: 'arm64', mobile: false });
  });
  it('works without userAgentData (Safari, Firefox)', async () => {
    expect(await detect({ userAgent: UA.winChrome })).toEqual({
      os: 'windows',
      arch: 'x64',
      mobile: false,
    });
  });
  it('maps 32-bit and unknown hints to no arch', () => {
    expect(archFromHints({ architecture: 'x86', bitness: '32' })).toBeUndefined();
    expect(archFromHints({})).toBeUndefined();
  });
});

describe('defaultChannel', () => {
  const all = [
    'script',
    'powershell',
    'brew',
    'scoop',
    'winget',
    'apt',
    'dnf',
    'apk',
    'go',
    'releases',
  ];
  const bundle = ['brew', 'scoop', 'winget', 'apt', 'dnf', 'apk', 'go', 'releases'];
  it.each([
    ['macos', all, 'brew'],
    ['windows', all, 'winget'],
    ['linux', all, 'script'],
    ['unknown', all, 'script'],
    ['linux', bundle, 'apt'],
    ['ios', bundle, 'brew'],
  ] as const)('%s -> %s', (os, available, expected) => {
    expect(defaultChannel(os, [...available])).toBe(expected);
  });
});

describe('parseHash', () => {
  it.each([
    ['#tokvera/brew', { product: 'tokvera', channel: 'brew' }],
    ['#sievant', { product: 'sievant' }],
    ['', {}],
    ['#main', { product: 'main' }],
    ['#<script>', {}],
  ])('%s', (hash, expected) => expect(parseHash(hash)).toEqual(expected));
});
