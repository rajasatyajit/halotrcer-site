// Platform detection for the install picker. Pure functions plus one async
// reader of navigator; unit-tested in tests/unit/detect.test.ts.

export type DetectedOs = 'macos' | 'windows' | 'linux' | 'ios' | 'android' | 'unknown';
export type DetectedArch = 'x64' | 'arm64';

export interface Platform {
  os: DetectedOs;
  arch?: DetectedArch;
  mobile: boolean;
}

interface UADataLike {
  platform?: string;
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; bitness?: string }>;
}

export interface NavigatorLike {
  userAgent: string;
  maxTouchPoints?: number;
  userAgentData?: UADataLike;
}

export function osFromUAData(platform: string | undefined): DetectedOs | undefined {
  switch ((platform ?? '').toLowerCase()) {
    case 'macos':
      return 'macos';
    case 'windows':
      return 'windows';
    case 'linux':
    case 'chrome os':
    case 'chromeos':
      return 'linux';
    case 'android':
      return 'android';
    case 'ios':
      return 'ios';
    default:
      return undefined;
  }
}

export function fromUserAgent(ua: string, maxTouchPoints = 0): Platform {
  let os: DetectedOs = 'unknown';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'ios';
  else if (/Android/.test(ua)) os = 'android';
  else if (/Windows/.test(ua)) os = 'windows';
  // iPadOS reports a Mac user agent; a touch screen gives it away.
  else if (/Macintosh|Mac OS X/.test(ua)) os = maxTouchPoints > 1 ? 'ios' : 'macos';
  else if (/CrOS|Linux|X11/.test(ua)) os = 'linux';
  let arch: DetectedArch | undefined;
  if (/aarch64|arm64|armv8/i.test(ua)) arch = 'arm64';
  else if (/x86_64|x64|Win64|WOW64|amd64/i.test(ua)) arch = 'x64';
  // Every Mac browser says "Intel"; that says nothing about the CPU.
  if (os === 'macos') arch = undefined;
  return { os, ...(arch ? { arch } : {}), mobile: os === 'ios' || os === 'android' };
}

export function archFromHints(h: {
  architecture?: string;
  bitness?: string;
}): DetectedArch | undefined {
  if (h.architecture === 'arm' && h.bitness !== '32') return 'arm64';
  if (h.architecture === 'x86' && h.bitness !== '32') return 'x64';
  return undefined;
}

export async function detect(nav: NavigatorLike): Promise<Platform> {
  const fallback = fromUserAgent(nav.userAgent, nav.maxTouchPoints ?? 0);
  const data = nav.userAgentData;
  const os = osFromUAData(data?.platform) ?? fallback.os;
  const mobile = data?.mobile ?? (os === 'ios' || os === 'android' || fallback.mobile);
  let arch = fallback.arch;
  if (data?.getHighEntropyValues) {
    try {
      arch = archFromHints(await data.getHighEntropyValues(['architecture', 'bitness'])) ?? arch;
    } catch {
      // Hints refused: keep the user-agent guess.
    }
  }
  return { os, ...(arch ? { arch } : {}), mobile: mobile || os === 'ios' || os === 'android' };
}

// Preferred channels per OS, best first. The first one a product has wins.
export const PREFERENCE: Record<DetectedOs, string[]> = {
  macos: ['brew', 'script', 'go', 'releases'],
  windows: ['winget', 'powershell', 'scoop', 'go', 'releases'],
  linux: ['script', 'apt', 'dnf', 'apk', 'go', 'releases'],
  // Phones get a "copy the link" note; the list still opens on a desktop default.
  ios: ['script', 'brew', 'go', 'releases'],
  android: ['script', 'apt', 'go', 'releases'],
  unknown: ['script', 'go', 'releases'],
};

export function defaultChannel(os: DetectedOs, available: string[]): string | undefined {
  return PREFERENCE[os].find((c) => available.includes(c)) ?? available[0];
}

// URL hash "#<product>" or "#<product>/<channel>".
export function parseHash(hash: string): { product?: string; channel?: string } {
  const m = /^#?([a-z]+)(?:\/([a-z]+))?$/.exec(hash);
  if (!m?.[1]) return {};
  return { product: m[1], ...(m[2] ? { channel: m[2] } : {}) };
}
