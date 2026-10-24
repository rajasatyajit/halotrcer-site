// Every number on the three boards comes from content/samples (owner, 2026-10-23): it equals
// the value derived from the JSON here, independently of src/lib/clues.ts, and changing the
// sample data changes every figure and every sentence with a number in it.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITES } from '../../src/config/site.ts';

const json = (id: string) => JSON.parse(readFileSync(`content/samples/${id}.json`, 'utf8'));
const t = json('tokvera-scan');
const s = json('sievant-posture');

const first = t.levels[0];
const last = t.levels.at(-1);
const codes = new Map<string, number>();
for (const l of t.levels)
  for (const [c, n] of Object.entries(l.status_counts ?? {}))
    codes.set(c, (codes.get(c) ?? 0) + (n as number));
const servers = s.architecture.client_servers;
const bypassing = servers.filter((x: { through_sievant: boolean }) => !x.through_sievant).length;
const credential = s.activity.events.find(
  (e: { name: string }) => e.name === 'CREDENTIAL_BLOCKED',
).count;
const top = s.activity.top_blocked[0];

// Every number a visitor reads on a clue card, as the JSON gives it.
const EXPECTED: Record<string, { figure: string; numbers: (string | number)[] }> = {
  'Repeated prompts': {
    figure: `${t.cache.prompts - t.cache.distinct} of ${t.cache.prompts}`,
    numbers: [t.cache.prompts - t.cache.distinct, t.cache.prompts],
  },
  'Rush hour': {
    figure: `${first.ttft_ms.p99} → ${last.ttft_ms.p99} ms`,
    numbers: [first.ttft_ms.p99, last.ttft_ms.p99, last.concurrency],
  },
  'Failed requests': {
    figure: `${t.run.failed} of ${t.run.requests}`,
    numbers: [...codes].flatMap(([c, n]) => [c, n]),
  },
  Grade: { figure: t.score.grade, numbers: [t.score.points] },
  'Credential in arguments': { figure: `${credential} blocked`, numbers: [] },
  'Behind the checkpoint': {
    figure: `${s.activity.blocked} of ${s.activity.requests}`,
    numbers: [s.activity.output_redactions],
  },
  'Tool calls blocked': {
    figure: `${s.activity.blocked} of ${s.activity.requests}`,
    numbers: [top.name, top.count],
  },
};
const serverFigure = (wrapped: boolean) =>
  wrapped
    ? `${servers.length - bypassing} of ${servers.length}`
    : `${bypassing} of ${servers.length}`;

describe('board numbers equal the sample data', () => {
  it.each(SITES)('%s', async (site) => {
    const { board } = await import('../../src/lib/clues.ts');
    for (const clue of board(site).clues) {
      const key = clue.title.startsWith('MCP server') ? null : clue.title;
      if (key === null) {
        expect(clue.figure).toBe(serverFigure(clue.body.includes('run through')));
        continue;
      }
      const want = EXPECTED[key];
      expect(want, `no expectation for "${clue.title}"`).toBeDefined();
      expect(clue.figure).toBe(want?.figure);
      for (const n of want?.numbers ?? []) expect(clue.body).toContain(String(n));
      // No number in the sentence that the JSON does not explain.
      // (p99 is a percentile name, not data.)
      for (const n of clue.body.match(/(?<![A-Za-z\d.])\d+(\.\d+)?/g) ?? [])
        expect([...(want?.numbers ?? []), ...clue.figure.split(/\D+/)].map(String)).toContain(n);
    }
  });
});

describe('changing a sample changes the board', () => {
  afterEach(() => {
    vi.doUnmock('../../src/lib/samples.ts');
    vi.resetModules();
  });

  it('every figure and every sentence with a number follows the data', async () => {
    const { board: before } = await import('../../src/lib/clues.ts');
    const original = Object.fromEntries(SITES.map((site) => [site, before(site)]));
    // Triple every number except the concurrency levels (the first must stay 1), change the
    // grade, and add a client server that bypasses Sievant (the server figures are counts).
    const bump = (v: unknown, key = ''): unknown =>
      typeof v === 'number' && key !== 'concurrency'
        ? v * 3 + 1
        : Array.isArray(v)
          ? [
              ...v.map((x) => bump(x)),
              ...(key === 'client_servers'
                ? [{ client: 'x', name: 'extra', transport: 'stdio', through_sievant: false }]
                : []),
            ]
          : v && typeof v === 'object'
            ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, bump(x, k)]))
            : key === 'grade'
              ? 'B'
              : v;
    vi.resetModules();
    vi.doMock('../../src/lib/samples.ts', async (importOriginal) => {
      const real = await importOriginal<typeof import('../../src/lib/samples.ts')>();
      return {
        ...real,
        sample: (id: string) => {
          const r = real.sample(id);
          return { ...r, data: bump(r.data) };
        },
      };
    });
    const { board: after } = await import('../../src/lib/clues.ts');
    for (const site of SITES) {
      const a = after(site).clues;
      original[site]?.clues.forEach((c, i) => {
        expect(a[i]?.figure, `${site}: ${c.title} figure`).not.toBe(c.figure);
        if (/\d/.test(c.body)) expect(a[i]?.body, `${site}: ${c.title} sentence`).not.toBe(c.body);
      });
    }
  });
});
