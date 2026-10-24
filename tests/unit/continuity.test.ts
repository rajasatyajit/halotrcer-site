import { describe, expect, it } from 'vitest';
import { claim } from '../../src/lib/claims.ts';

describe('continuity claim', () => {
  it('says "will be" before launch and "are" after', () => {
    expect(claim('www.continuity.prelaunch').text).toMatch(/will be Apache-2\.0/);
    expect(claim('www.continuity.prelaunch').text).not.toMatch(/\bare Apache-2\.0/);
    expect(claim('www.continuity').text).toMatch(/are Apache-2\.0/);
  });
});
