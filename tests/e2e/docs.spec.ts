// Docs: Pagefind search under the real docs CSP (with 'wasm-unsafe-eval'),
// and the navigation that replaces search without JavaScript.
import { expect, test } from '@playwright/test';
import { ORIGINS, watchErrors } from './helpers.ts';

test('docs search finds a page and links to it', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${ORIGINS.tokvera}/docs`);
  await page.getByRole('searchbox', { name: 'Search the docs' }).fill('concurrency');
  const first = page.locator('[data-docs-search-results] li a').first();
  await expect(first).toBeVisible();
  await expect(page.locator('[data-docs-search-status]')).toHaveText(/\d+ results/);
  const href = await first.getAttribute('href');
  expect(href).toMatch(/^\/docs\/|^\/scoring|^\/faq/);
  expect(errors).toEqual([]);
});

test('the site CSP (no wasm) still applies outside /docs', async ({ request }) => {
  const home = await request.get(`${ORIGINS.tokvera}/`);
  expect(home.headers()['content-security-policy']).not.toContain('wasm-unsafe-eval');
  const docs = await request.get(`${ORIGINS.tokvera}/docs/scan`);
  expect(docs.headers()['content-security-policy']).toContain("'wasm-unsafe-eval'");
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('search is hidden and the navigation lists the docs', async ({ page }) => {
    await page.goto(`${ORIGINS.sievant}/docs`);
    await expect(page.getByRole('searchbox')).toBeHidden();
    expect(await page.locator('.docs__nav li a').count()).toBeGreaterThan(5);
  });
});
