// Share button: the Web Share API when present, else the link is copied.
import { expect, test } from '@playwright/test';
import { CLIPBOARD_PERMISSIONS, copied, ORIGINS, recordClipboard } from './helpers.ts';

test('uses the Web Share API when the browser has it', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared?: ShareData };
    Object.defineProperty(navigator, 'share', {
      value: async (data: ShareData) => {
        w.__shared = data;
      },
    });
  });
  await page.goto(`${ORIGINS.sievant}/owasp-llm-top-10`);
  await page.getByRole('button', { name: 'Share this page' }).click();
  const shared = await page.evaluate(
    () => (window as unknown as { __shared?: ShareData }).__shared,
  );
  expect(shared?.url).toBe(`${ORIGINS.sievant}/owasp-llm-top-10`);
  expect(shared?.title).toContain('OWASP');
});

test.describe('without the Web Share API', () => {
  test.use({ permissions: CLIPBOARD_PERMISSIONS });
  test('copies the link and says so', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await recordClipboard(page);
    await page.goto(`${ORIGINS.www}/audit`);
    await page.getByRole('button', { name: 'Share this page' }).click();
    await expect(page.locator('[data-copy-status]')).toHaveText('Link copied to the clipboard');
    expect(await copied(page)).toBe(`${ORIGINS.www}/audit`);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the share button is hidden', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/audit`);
    await expect(page.getByRole('button', { name: 'Share this page' })).toBeHidden();
  });
});
