import type { Page } from '@playwright/test';

// Browser under test: Chromium everywhere; CI adds Firefox and WebKit on main
// (PW_BROWSER, read by playwright.config.ts too).
export const BROWSER = (process.env.PW_BROWSER ?? 'chromium') as 'chromium' | 'firefox' | 'webkit';

// Only Chromium accepts a clipboard permission grant.
export const CLIPBOARD_PERMISSIONS = BROWSER === 'chromium' ? ['clipboard-write'] : [];

// Records clipboard writes in window.__copied. Our Permissions-Policy denies
// clipboard-read, so tests can't read the clipboard back. Chromium also runs the
// real writeText; Firefox and WebKit refuse it without a real user gesture, so
// there the write is only recorded.
export async function recordClipboard(page: Page): Promise<void> {
  await page.addInitScript((real: boolean) => {
    const w = window as unknown as { __copied?: string };
    const clipboard = navigator.clipboard as Clipboard | undefined;
    const original = real && clipboard ? clipboard.writeText.bind(clipboard) : undefined;
    const writeText = (text: string) => {
      w.__copied = text;
      return original ? original(text) : Promise.resolve();
    };
    if (clipboard) clipboard.writeText = writeText;
    else Object.defineProperty(navigator, 'clipboard', { value: { writeText } });
  }, BROWSER === 'chromium');
}

export const copied = (page: Page) =>
  page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '');

export const ORIGINS = {
  www: 'http://127.0.0.1:4321',
  tokvera: 'http://127.0.0.1:4322',
  sievant: 'http://127.0.0.1:4323',
} as const;

export const KEY_PAGES: [keyof typeof ORIGINS, string][] = [
  ['www', '/'],
  ['www', '/audit'],
  ['www', '/pricing'],
  ['www', '/scoring'],
  ['www', '/security'],
  ['www', '/about'],
  ['www', '/privacy'],
  ['www', '/terms'],
  ['www', '/install'],
  ['www', '/calculator'],
  ['www', '/blog'],
  ['www', '/blog/what-an-mcp-config-scan-looks-for'],
  ['www', '/book'],
  ['www', '/no-such-page'],
  ['tokvera', '/'],
  ['tokvera', '/scoring'],
  ['tokvera', '/sample-report'],
  ['tokvera', '/integrations'],
  ['tokvera', '/faq'],
  ['tokvera', '/calculator'],
  ['tokvera', '/docs'],
  ['tokvera', '/docs/scan'],
  ['tokvera', '/no-such-page'],
  ['sievant', '/'],
  ['sievant', '/scoring'],
  ['sievant', '/owasp-llm-top-10'],
  ['sievant', '/sample-report'],
  ['sievant', '/integrations'],
  ['sievant', '/faq'],
  ['sievant', '/scan'],
  ['sievant', '/docs'],
  ['sievant', '/docs/scan-and-wrap'],
  ['sievant', '/no-such-page'],
];

// Collects console errors and CSP violations for a page.
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
