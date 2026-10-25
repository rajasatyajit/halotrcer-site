import { expect, test } from '@playwright/test';
import { url } from '../../src/config/site.ts';
import { claim } from '../../src/lib/claims.ts';
import { wrap } from '../../src/lib/og.ts';
import { loadPricing, priceLabel, serviceFor } from '../../src/lib/pricing.ts';
import { ORIGINS } from './helpers.ts';

// Task 9: the www paper pages (pricing, audit, security) and the 404s.
// Before launch the binaries "will be" yours to keep (as /pricing says); after launch they "are".
const LAUNCHED = process.env.LAUNCHED === 'true';
const continuity = claim(LAUNCHED ? 'www.continuity' : 'www.continuity.prelaunch').text;
const otherContinuity = claim(LAUNCHED ? 'www.continuity.prelaunch' : 'www.continuity').text;

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
    'What if you stop maintaining it?',
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

test('/agencies: the licence line says "will both be" before launch and "are both" after', async ({
  page,
}) => {
  await page.goto(`${ORIGINS.www}/agencies`);
  const lede = page.locator('.page-head .lede');
  await expect(lede).toHaveText(
    `You build and run AI products for clients. Tokvera and Sievant ${LAUNCHED ? 'are both' : 'will both be'} Apache-2.0.`,
  );
});

test('/agencies: Launching soon and "once released" before launch; unchanged after', async ({
  page,
}) => {
  await page.goto(`${ORIGINS.www}/agencies`);
  const soon = page.locator('main [data-launching-soon]');
  const run = page
    .locator('section', { has: page.locator('#run') })
    .locator('p')
    .first();
  if (LAUNCHED) {
    await expect(soon).toHaveCount(0);
    await expect(run).toHaveText(
      "Run Tokvera against a client's inference endpoint and Sievant against their agents' tools, then hand over the reports. See what a report looks like first:",
    );
    return;
  }
  await expect(soon).toHaveCount(1);
  await expect(soon.getByRole('heading', { level: 2 })).toHaveText(
    'Tokvera, Sievant and Halotrcer aren’t released yet',
  );
  // This page has no install picker after launch, so the block points at /install, not "here".
  await expect(soon).toContainText(
    'Install commands will appear on the install page on release day.',
  );
  await expect(soon).not.toContainText('appear here');
  await expect(soon.locator(`a[href="${url('www', '/install')}"]`)).toHaveText('install page');
  await expect(soon.getByRole('link', { name: 'Book a call' })).toBeVisible();
  await expect(soon.locator('a[href^="mailto:"]')).toBeVisible();
  await expect(run).toHaveText(
    "Once Tokvera and Sievant are released, you can run Tokvera against a client's inference endpoint and Sievant against their agents' tools, then hand over the reports. Until then, see what a report looks like:",
  );
});

test('/agencies: meta and share text say "once released" before launch; unchanged after', async ({
  page,
}) => {
  await page.goto(`${ORIGINS.www}/agencies`);
  const text = LAUNCHED
    ? 'Run Tokvera and Sievant for your clients: name the client in the Sievant report and leave our call-to-action footers out. Talk to us about referrals.'
    : 'Once released, run Tokvera and Sievant for your clients: name the client in the Sievant report and leave our call-to-action footers out. Talk to us about referrals.';
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', text);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', text);
  // The share image draws this text in three lines of 58 characters (src/lib/og.ts); none is cut.
  expect(wrap(text, 58, 3).join(' ')).toBe(text);
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
      has: page.getByRole('heading', { name: 'What if you stop maintaining it?' }),
    });
    await expect(section).toContainText(continuity);
  });

for (const [site, path] of [
  ['www', '/'],
  ['www', '/pricing'],
  ['www', '/security'],
  ['tokvera', '/faq'],
  ['sievant', '/faq'],
] as const)
  test(`${site}${path}: the continuity answer matches the mode`, async ({ page }) => {
    await page.goto(`${ORIGINS[site]}${path}`);
    await expect(page.locator('main')).toContainText(continuity);
    await expect(page.locator('main')).not.toContainText(otherContinuity);
  });
