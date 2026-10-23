import { describe, expect, it } from 'vitest';
import { docTarget } from '../../scripts/lib/doc-target.ts';

describe('docTarget', () => {
  it('keeps a docs file name', () => {
    expect(docTarget('docs/scan.md')).toEqual({ slug: 'scan', file: 'scan.md' });
  });

  it('lowercases a repo-root file such as SECURITY.md', () => {
    expect(docTarget('SECURITY.md')).toEqual({ slug: 'security', file: 'security.md' });
  });
});
