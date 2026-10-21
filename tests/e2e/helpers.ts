import type { Page } from '@playwright/test';

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
  ['www', '/book'],
  ['www', '/no-such-page'],
  ['tokvera', '/'],
  ['tokvera', '/scoring'],
  ['tokvera', '/sample-report'],
  ['tokvera', '/integrations'],
  ['tokvera', '/faq'],
  ['tokvera', '/docs'],
  ['tokvera', '/docs/scan'],
  ['tokvera', '/no-such-page'],
  ['sievant', '/'],
  ['sievant', '/scoring'],
  ['sievant', '/owasp-llm-top-10'],
  ['sievant', '/sample-report'],
  ['sievant', '/integrations'],
  ['sievant', '/faq'],
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
