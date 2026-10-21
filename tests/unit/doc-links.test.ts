import { describe, expect, it } from 'vitest';
import { docHref } from '../../src/lib/doc-links.ts';

const base = { product: 'tokvera', docPath: 'docs/scan.md', repo: 'tokvera', commit: 'abc123' };

describe('synced doc links', () => {
  it('keeps absolute, fragment and site links', () => {
    for (const href of ['https://example.com', 'mailto:a@b.c', '#suites', '/install']) {
      expect(docHref({ ...base, href, launched: false })).toBe(href);
    }
  });
  it('points links to synced docs at the site', () => {
    expect(docHref({ ...base, href: 'report-anatomy.md#json', launched: false })).toBe(
      '/docs/report-anatomy#json',
    );
  });
  it('uses promoted pages for scoring and the FAQ', () => {
    expect(docHref({ ...base, href: 'scoring.md', launched: false })).toBe('/scoring');
    expect(docHref({ ...base, href: './faq.md#offline', launched: true })).toBe('/faq#offline');
  });
  it('links repo files to GitHub at the synced commit only when launched', () => {
    expect(docHref({ ...base, href: '../SECURITY.md', launched: true })).toBe(
      'https://github.com/rajasatyajit/tokvera/blob/abc123/SECURITY.md',
    );
    expect(docHref({ ...base, href: '../SECURITY.md', launched: false })).toBeUndefined();
  });
  it('drops links to launch-only docs before launch', () => {
    expect(docHref({ ...base, href: 'install.md', launched: false })).toBeUndefined();
    expect(docHref({ ...base, href: 'install.md', launched: true })).toBe('/docs/install');
  });
});
