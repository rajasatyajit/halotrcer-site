import { describe, expect, it } from 'vitest';
import { skipped, verdict } from '../../scripts/lib/external.ts';

describe('external link check', () => {
  it('skips the private GitHub repos until launch, and the fixture release always', () => {
    expect(skipped('https://github.com/rajasatyajit/tokvera', false)).toBe(true);
    expect(skipped('https://github.com/rajasatyajit/tokvera', true)).toBe(false);
    expect(
      skipped('https://github.com/rajasatyajit/tokvera/releases/tag/v0.0.0-fixture', true),
    ).toBe(true);
    expect(skipped('https://genai.owasp.org/llm-top-10/', false)).toBe(false);
  });

  it.each([
    [200, 'ok'],
    [301, 'ok'],
    [403, 'unverified'],
    [429, 'unverified'],
    [404, 'broken'],
    [410, 'broken'],
    [503, 'broken'],
    [undefined, 'broken'],
  ] as const)('reads %s as %s', (status, want) => {
    expect(verdict(status)).toBe(want);
  });
});
