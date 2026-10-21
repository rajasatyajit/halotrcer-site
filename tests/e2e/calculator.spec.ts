// AI bill leak calculator: computes from the reader's inputs, round-trips
// through the query string, copies a result, and degrades to the formula.
import { expect, test, type Page } from '@playwright/test';
import { ORIGINS } from './helpers.ts';

const PAGE = `${ORIGINS.www}/calculator`;
// 1M requests × (1000 × 2 + 100 × 10) / 1M = 3,000.00; 1M × 1000 × 25% × 2 / 1M = 500.00
const INPUTS = { r: '1000000', tin: '1000', tout: '100', pin: '2', pout: '10', h: '25' };
const QUERY = new URLSearchParams(INPUTS).toString();

const out = (page: Page, name: string) => page.locator(`[data-calc-out="${name}"]`);

async function fillAll(page: Page): Promise<void> {
  for (const [name, value] of Object.entries(INPUTS)) {
    await page.locator(`input[name="${name}"]`).fill(value);
  }
}

test('starts empty: no default prices', async ({ page }) => {
  await page.goto(PAGE);
  for (const name of Object.keys(INPUTS)) {
    await expect(page.locator(`input[name="${name}"]`)).toHaveValue('');
  }
  await expect(out(page, 'spend')).toHaveText('–');
});

test('computes from the inputs and puts them in the URL', async ({ page }) => {
  await page.goto(PAGE);
  await fillAll(page);
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(out(page, 'spend')).toHaveText('3,000.00');
  await expect(out(page, 'repeat')).toHaveText('500.00');
  await expect(out(page, 'share')).toHaveText('16.7%');
  expect(new URL(page.url()).search).toBe(`?${QUERY}`);
});

test('a shared link restores the inputs and the result', async ({ page }) => {
  await page.goto(`${PAGE}?${QUERY}`);
  await expect(page.locator('input[name="h"]')).toHaveValue('25');
  await expect(out(page, 'repeat')).toHaveText('500.00');
});

test('the same link works on Tokvera', async ({ page }) => {
  await page.goto(`${ORIGINS.tokvera}/calculator?${QUERY}`);
  await expect(out(page, 'spend')).toHaveText('3,000.00');
});

test('invalid or partial links compute nothing', async ({ page }) => {
  await page.goto(`${PAGE}?r=-5&tin=1&tout=1&pin=1&pout=1&h=1`);
  await expect(out(page, 'spend')).toHaveText('–');
  await page.goto(`${PAGE}?r=1&tin=1`);
  await expect(out(page, 'spend')).toHaveText('–');
});

test('an incomplete form is not submitted', async ({ page }) => {
  await page.goto(PAGE);
  await page.locator('input[name="r"]').fill('1000');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(out(page, 'spend')).toHaveText('–');
  expect(new URL(page.url()).search).toBe('');
});

test('example values are labelled as not real prices', async ({ page }) => {
  await page.goto(PAGE);
  await page.getByRole('button', { name: /example values \(not real prices\)/i }).click();
  await expect(out(page, 'spend')).not.toHaveText('–');
  await expect(page.locator('[data-copy-status]')).toContainText('not any provider’s real prices');
});

test.describe('copy', () => {
  test.use({ permissions: ['clipboard-write'] });
  test('copies a summary and the link, and never says savings', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __copied?: string };
      const original = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = (t: string) => {
        w.__copied = t;
        return original(t);
      };
    });
    await page.goto(`${PAGE}?${QUERY}`);
    await page.getByRole('button', { name: 'Copy result and link' }).click();
    await expect(page.locator('[data-copy-status]')).toHaveText(
      'Result and link copied to the clipboard',
    );
    const copied = await page.evaluate(
      () => (window as unknown as { __copied?: string }).__copied ?? '',
    );
    expect(copied).toContain('3,000.00');
    expect(copied).toContain(`${PAGE}?${QUERY}`);
    expect(copied).not.toMatch(/sav(e|ing)/i);
  });
});

test('responds to Calculate quickly (INP proxy)', async ({ page }) => {
  await page.goto(PAGE);
  await fillAll(page);
  const ms = await page.evaluate(async () => {
    const button = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Calculate',
    );
    const start = performance.now();
    button?.click();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return performance.now() - start;
  });
  expect(ms).toBeLessThan(100);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('shows the formula and says the calculator needs JavaScript', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeHidden();
    await expect(page.getByText('The calculator needs JavaScript.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How it is calculated' })).toBeVisible();
  });
});
