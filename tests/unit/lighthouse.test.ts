// Gate: LCP is the median of 3 Lighthouse runs per page, under
// 1.4 s (owner, 2026-10-23): the Marker font puts simulated LCP on a 1.21 / 1.36 / 1.51 s step; 30 runs after subsetting were all ≤ 1.36 s, so 1.4 s passes the current font and still fails if it adds another step.
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

  it('asserts LCP < 1.4 s on the median run, in every matrix entry', () => {
    for (const { assertions } of matrix)
      expect(assertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 1400, aggregationMethod: 'median' },
      ]);
  });

  it('keeps all four categories at 100', () => {
    expect(matrix[0]?.assertions['categories:performance']).toEqual(['error', { minScore: 1 }]);
  });
});
