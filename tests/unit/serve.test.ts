import { describe, expect, it } from 'vitest';
import { portsFrom } from '../../scripts/serve.ts';

describe('local server ports', () => {
  it('gives each host a consecutive port from the base', () => {
    expect(portsFrom(4521)).toEqual({ www: 4521, tokvera: 4522, sievant: 4523 });
  });

  it('keeps the default base on www', () => {
    expect(portsFrom(4321).www).toBe(4321);
  });
});
