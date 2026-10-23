// Gate (owner decisions 2026-10-23): LCP is the median of 3 Lighthouse runs per page, under
// 1.3 s. Permanent Marker on the first screen costs about 0.3 s on Lighthouse's simulated
// mobile connection; the Case File home (Marker only, not preloaded) measured 1.21 s median.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('lighthouserc', () => {
  process.env.SITE = 'www';
  const config = require('../../lighthouserc.cjs');
  const matrix = config.ci.assert.assertMatrix as { assertions: Record<string, unknown> }[];

  it('runs every page 3 times', () => {
    expect(config.ci.collect.numberOfRuns).toBe(3);
  });

  it('asserts LCP < 1.3 s on the median run, in every matrix entry', () => {
    for (const { assertions } of matrix)
      expect(assertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 1300, aggregationMethod: 'median' },
      ]);
  });

  it('keeps all four categories at 100', () => {
    expect(matrix[0]?.assertions['categories:performance']).toEqual(['error', { minScore: 1 }]);
  });
});
