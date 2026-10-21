import { describe, expect, it } from 'vitest';
import {
  problems,
  record,
  redirectSources,
  sitemapUrls,
  type Recorded,
} from '../../scripts/lib/permanence.ts';

const W = 'https://www.halotrcer.com';
const T = 'https://tokvera.halotrcer.com';

describe('URL permanence', () => {
  it('reads sitemap URLs and redirect sources', () => {
    expect(
      sitemapUrls(`<url><loc>${W}/a?x=1&amp;y=2</loc></url><url><loc>${W}/b</loc></url>`),
    ).toEqual([`${W}/a?x=1&y=2`, `${W}/b`]);
    expect(redirectSources('/install https://www.halotrcer.com/install#tokvera 301\n\n')).toEqual(
      new Set(['/install']),
    );
  });

  it('records new URLs without removing or downgrading any', () => {
    const r = record(
      { [`${W}/old`]: 'prelaunch', [`${W}/docs/x`]: 'launched' },
      [`${W}/new`],
      'prelaunch',
    );
    expect(r).toEqual({
      [`${W}/docs/x`]: 'launched',
      [`${W}/new`]: 'prelaunch',
      [`${W}/old`]: 'prelaunch',
    });
    expect(record(r, [`${W}/docs/x`], 'prelaunch')[`${W}/docs/x`]).toBe('prelaunch');
    expect(record(r, [`${W}/old`], 'launched')[`${W}/old`]).toBe('prelaunch');
  });

  const recorded: Recorded = { [`${W}/a`]: 'prelaunch', [`${W}/docs/x`]: 'launched' };

  it('fails when a published URL disappears without a redirect', () => {
    const out = problems(
      recorded,
      [{ site: 'www', sitemap: [`${W}/docs/x`], redirects: new Set() }],
      'launched',
    );
    expect(out).toEqual([`${W}/a was published and is gone: add a 301 in src/data/redirects.ts`]);
  });

  it('accepts a redirect in place of the page', () => {
    const out = problems(
      recorded,
      [{ site: 'www', sitemap: [`${W}/docs/x`], redirects: new Set(['/a']) }],
      'launched',
    );
    expect(out).toEqual([]);
  });

  it('only requires pre-launch URLs in a pre-launch build', () => {
    expect(
      problems(recorded, [{ site: 'www', sitemap: [`${W}/a`], redirects: new Set() }], 'prelaunch'),
    ).toEqual([]);
  });

  it('fails on a sitemap URL that was never recorded', () => {
    const out = problems(
      recorded,
      [{ site: 'www', sitemap: [`${W}/a`, `${W}/b`], redirects: new Set() }],
      'prelaunch',
    );
    expect(out).toEqual([`${W}/b is new: run npm run urls:record and commit the file`]);
  });

  it('checks each host only against its own URLs', () => {
    expect(
      problems(recorded, [{ site: 'tokvera', sitemap: [], redirects: new Set() }], 'launched'),
    ).toEqual([]);
    expect(
      problems(
        { [`${T}/`]: 'prelaunch' },
        [{ site: 'tokvera', sitemap: [], redirects: new Set() }],
        'prelaunch',
      ),
    ).toHaveLength(1);
  });
});
