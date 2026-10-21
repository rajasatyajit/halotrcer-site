// Lighthouse CI budgets (mobile emulation, the default form factor).
// Usage: SITE=www lhci autorun --config=lighthouserc.cjs   (after building that site)
const site = process.env.SITE;
if (!['www', 'tokvera', 'sievant'].includes(site)) throw new Error('Set SITE=www|tokvera|sievant');

// Key pages per host. Paths are the built files (the LHCI static server has no clean URLs).
const PAGES = {
  www: ['/index.html', '/book.html', '/404.html'],
  tokvera: ['/index.html', '/404.html'],
  sievant: ['/index.html', '/404.html'],
};

module.exports = {
  ci: {
    collect: {
      staticDistDir: `./dist/${site}`,
      url: PAGES[site].map((p) => `http://localhost${p}`),
      numberOfRuns: 3,
      settings: { chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 1 }],
        'categories:accessibility': ['error', { minScore: 1 }],
        'categories:best-practices': ['error', { minScore: 1 }],
        'categories:seo': ['error', { minScore: 1 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 1200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0 }],
        // Lab proxy for INP; interaction timing is also tested in Playwright.
        'total-blocking-time': ['error', { maxNumericValue: 100 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 20480 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 256000 }],
        'resource-summary:third-party:count': ['error', { maxNumericValue: 0 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
