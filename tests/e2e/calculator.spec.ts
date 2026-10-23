// AI bill leak calculator: computes from the reader's inputs, round-trips
// through the query string, copies a result, and degrades to the formula.
import { expect, test, type Page } from '@playwright/test';
import { CLIPBOARD_PERMISSIONS, copied, ORIGINS, recordClipboard } from './helpers.ts';

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
  test.use({ permissions: CLIPBOARD_PERMISSIONS });
  test('copies a summary and the link, and never says savings', async ({ page }) => {
    await recordClipboard(page);
    await page.goto(`${PAGE}?${QUERY}`);
    await page.getByRole('button', { name: 'Copy result and link' }).click();
    await expect(page.locator('[data-copy-status]')).toHaveText(
      'Result and link copied to the clipboard',
    );
    const text = await copied(page);
    expect(text).toContain('3,000.00');
    expect(text).toContain(`${PAGE}?${QUERY}`);
    expect(text).not.toMatch(/sav(e|ing)/i);
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

// Example values stay labelled wherever the result goes: on the card, in the link (ex=1)
// and in the copied text. Editing a field makes them the visitor's own numbers again.
test.describe('example label', () => {
  const label = (page: import('@playwright/test').Page) => page.locator('[data-example-label]');

  test('the example fill labels the result and the link', async ({ page }) => {
    await page.goto(PAGE);
    await expect(label(page)).toBeHidden();
    await page.getByRole('button', { name: /example values \(not real prices\)/i }).click();
    await expect(label(page)).toBeVisible();
    await expect(label(page)).toHaveText('Example values (not real prices).');
    expect(new URL(page.url()).searchParams.get('ex')).toBe('1');
  });

  test('typing after the example fill clears the example result, not just its label', async ({
    page,
  }) => {
    await page.goto(PAGE);
    await page.getByRole('button', { name: /example values \(not real prices\)/i }).click();
    await expect(out(page, 'spend')).not.toHaveText('–');
    await page.locator('input[name="r"]').fill('123');
    // Example figures never stay on screen (or in the link, or the copy) without their label.
    await expect(label(page)).toBeHidden();
    await expect(out(page, 'spend')).toHaveText('–');
    expect(new URL(page.url()).search).toBe('');
    await page.getByRole('button', { name: 'Copy result and link' }).click();
    await expect(page.locator('[data-copy-status]')).toHaveText('Calculate a result first.');
  });

  test('a shared example link shows the label; a plain link does not', async ({ page }) => {
    await page.goto(`${PAGE}?${QUERY}&ex=1`);
    await expect(label(page)).toBeVisible();
    await page.goto(`${PAGE}?${QUERY}`);
    await expect(label(page)).toBeHidden();
  });

  test.describe('copy', () => {
    test.use({ permissions: CLIPBOARD_PERMISSIONS });
    test('the copied text starts with the label', async ({ page }) => {
      await recordClipboard(page);
      await page.goto(`${PAGE}?${QUERY}&ex=1`);
      await page.getByRole('button', { name: 'Copy result and link' }).click();
      await expect
        .poll(async () => (await copied(page)).split('\n')[0])
        .toBe('Example values (not real prices).');
    });
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('the card shows its estimate stamp and no example label', async ({ page }) => {
      await page.goto(`${PAGE}?${QUERY}&ex=1`);
      await expect(label(page)).toBeHidden();
      const card = page.locator('[data-calc-result]');
      await expect(card.locator('[data-stamp]')).toHaveText(/Estimate/);
      await expect(card).toContainText('Estimate from your inputs: not a measurement');
    });
  });
});
