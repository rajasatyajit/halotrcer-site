import { expect, test } from '@playwright/test';
import { url } from '../../src/config/site.ts';
import { claim } from '../../src/lib/claims.ts';
import { loadPricing, priceLabel, serviceFor } from '../../src/lib/pricing.ts';
import { ORIGINS } from './helpers.ts';

// Task 9: the www paper pages (pricing, audit, security) and the 404s.
const continuity = claim('www.continuity').text;

test('/pricing: Hire the detectives, the three services, founding band, before you book', async ({
  page,
}) => {
  await page.goto(`${ORIGINS.www}/pricing`);
  await expect(page).toHaveTitle(/^Pricing · /);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hire the detectives');
  const { services, founding_offer } = loadPricing();
  for (const s of services) {
    const card = page.locator(`#service-${s.id}`).locator('xpath=ancestor::article');
    await expect(card).toContainText(priceLabel(s));
    await expect(card).toContainText(s.kicker);
    await expect(card).toContainText(s.duration);
  }
  if (founding_offer)
    await expect(page.locator('.case-tag--band')).toContainText(founding_offer.text);
  const before = page.locator('section', {
    has: page.getByRole('heading', { name: 'Before you book' }),
  });
  for (const s of services) for (const d of s.deliverables) await expect(before).toContainText(d);
  await expect(before).toContainText(continuity);
});

test('/audit: price and duration up top, what we will not claim second', async ({ page }) => {
  await page.goto(`${ORIGINS.www}/audit`);
  const audit = serviceFor('cost-security-audit');
  const head = page.locator('.page-head');
  await expect(head).toContainText(priceLabel(audit));
  await expect(head).toContainText(audit.duration);
  const h2s = await page.locator('main h2').allTextContents();
  expect(h2s[1]).toBe('What we will not claim');
  const grid = page.locator('.grid-3').first();
  for (const d of audit.deliverables) await expect(grid).toContainText(d);
});

test('/security: continuity and questionnaire sections first, email route kept', async ({
  page,
}) => {
  await page.goto(`${ORIGINS.www}/security`);
  const h2s = await page.locator('main h2').allTextContents();
  expect(h2s.slice(0, 2)).toEqual([
    'What if the maintainer disappears?',
    'For your security questionnaire',
  ]);
  await expect(page.locator('main')).toContainText(continuity);
  const q = page.locator('section', {
    has: page.getByRole('heading', { name: 'For your security questionnaire' }),
  });
  for (const href of [
    url('sievant', '/sample-report#review'),
    url('sievant', '/owasp-llm-top-10'),
    url('tokvera', '/docs/security'),
    url('sievant', '/docs/threat-model'),
  ])
    await expect(q.locator(`a[href="${href}"]`)).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Report a vulnerability' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/private vulnerability reporting/i);
});

for (const [site, reports] of [
  ['www', ['tokvera', 'sievant']],
  ['tokvera', ['tokvera']],
  ['sievant', ['sievant']],
] as const)
  test(`${site} 404: a paper card with links home and to the sample report`, async ({ page }) => {
    const res = await page.goto(`${ORIGINS[site]}/no-such-page`);
    expect(res?.status()).toBe(404);
    const card = page.locator('.not-found');
    await expect(card.getByRole('heading', { level: 1 })).toHaveText('No such page on this board');
    await expect(card.locator(`a[href="${url(site)}"]`)).toHaveCount(1);
    for (const r of reports)
      await expect(card.locator(`a[href="${url(r, '/sample-report')}"]`)).toHaveCount(1);
  });

test('/agencies: what the report can carry, no branding option, referrals', async ({ page }) => {
  await page.goto(`${ORIGINS.www}/agencies`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'For agencies and consultancies',
  );
  const main = page.locator('main');
  for (const id of [
    'sievant.report-org',
    'sievant.report-no-cta',
    'tokvera.scan-no-cta',
    'halotrcer.check-no-cta',
  ])
    await expect(main).toContainText(claim(id).text);
  await expect(main).toContainText('There is no logo or branding option.');
  await expect(main).not.toContainText(/white[- ]?label/i);
  await expect(page.getByRole('heading', { name: 'Talk to us about referrals' })).toBeVisible();
  for (const href of [
    url('tokvera', '/sample-report'),
    url('sievant', '/sample-report'),
    url('www', '/pricing'),
  ])
    await expect(main.locator(`a[href="${href}"]`).first()).toBeVisible();
});

test('/agencies is linked from pricing and the footer', async ({ page }) => {
  await page.goto(`${ORIGINS.www}/pricing`);
  await expect(page.locator(`main a[href="${url('www', '/agencies')}"]`)).toHaveCount(1);
  await expect(page.locator(`footer a[href="${url('www', '/agencies')}"]`)).toHaveCount(1);
});

for (const site of ['tokvera', 'sievant'] as const)
  test(`${site}/faq: the continuity answer after the synced FAQ`, async ({ page }) => {
    await page.goto(`${ORIGINS[site]}/faq`);
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: 'What if the maintainer stops?' }),
    });
    await expect(section).toContainText(continuity);
  });
