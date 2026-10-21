import { describe, expect, it } from 'vitest';
import { proofSchema } from '../../src/lib/proof-schema.ts';

const valid = {
  attribution: 'Jane Doe, CTO',
  source: 'Email to Satyajit, 2026-11-03',
  permission: 'Written permission to publish, email 2026-11-04',
  date: '2026-11-03',
};

describe('customer proof frontmatter', () => {
  it('accepts a quote with attribution, source, permission and date', () => {
    expect(proofSchema.parse(valid).date).toBeInstanceOf(Date);
  });

  it.each(['attribution', 'source', 'permission', 'date'] as const)('requires %s', (key) => {
    const rest = Object.fromEntries(Object.entries(valid).filter(([k]) => k !== key));
    expect(proofSchema.safeParse(rest).success).toBe(false);
  });

  it('only names real hosts', () => {
    expect(proofSchema.safeParse({ ...valid, hosts: ['blog'] }).success).toBe(false);
  });
});
