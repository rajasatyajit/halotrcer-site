// Security headers for every host, written to dist/<site>/_headers at build time.
// The `headers` CI job parses that file and asserts this policy.
import type { Flags } from './flags.ts';

const ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com';
const ANALYTICS_CONNECT = 'https://cloudflareinsights.com';

export function contentSecurityPolicy(flags: Pick<Flags, 'analytics'>): string {
  const script = ["'self'", ...(flags.analytics ? [ANALYTICS_SCRIPT] : [])];
  const connect = ["'self'", ...(flags.analytics ? [ANALYTICS_CONNECT] : [])];
  return [
    "default-src 'none'",
    `script-src ${script.join(' ')}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

// Everything the site doesn't use is denied. clipboard-write stays allowed for copy buttons.
export const PERMISSIONS_POLICY = [
  'accelerometer',
  'autoplay',
  'browsing-topics',
  'camera',
  'clipboard-read',
  'display-capture',
  'encrypted-media',
  'fullscreen',
  'geolocation',
  'gyroscope',
  'hid',
  'idle-detection',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'picture-in-picture',
  'publickey-credentials-get',
  'screen-wake-lock',
  'serial',
  'usb',
  'xr-spatial-tracking',
]
  .map((f) => `${f}=()`)
  .join(', ');

export function securityHeaders(flags: Pick<Flags, 'analytics'>): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(flags),
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': PERMISSIONS_POLICY,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  };
}

// Install scripts: plain text (never executed by a browser) with a short cache,
// so a new release reaches `curl | sh` within minutes. The /* rule's headers
// (nosniff, same-origin CORP) still apply; curl ignores CORP.
export const SCRIPT_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
};

export function headersFile(flags: Pick<Flags, 'analytics'>, scripts: string[] = []): string {
  const block = (path: string, headers: Record<string, string>) =>
    [path, ...Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`)].join('\n');
  return (
    [
      block('/*', securityHeaders(flags)),
      block('/_astro/*', { 'Cache-Control': 'public, max-age=31536000, immutable' }),
      ...scripts.map((path) => block(path, SCRIPT_HEADERS)),
    ].join('\n\n') + '\n'
  );
}
