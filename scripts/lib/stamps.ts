// Sample labels travel with what gets cropped: every table and section inside a
// [data-sample] region must carry its own [data-stamp]. Unit-tested in
// tests/unit/stamps.test.ts; run on the built pages by scripts/check-stamps.ts.
import type { HTMLElement } from 'node-html-parser';

export function missingStamps(root: HTMLElement): string[] {
  // data-simulated="false" marks sourced data that is not a demo run (the OWASP mapping).
  return root.querySelectorAll('[data-sample]:not([data-simulated="false"])').flatMap((region) => {
    const id = region.getAttribute('data-sample') ?? '?';
    return region.querySelectorAll('table, section').flatMap((el, i) => {
      const where = el.tagName === 'TABLE' ? el.querySelector('caption') : el;
      if (where?.querySelector('[data-stamp]')) return [];
      return [`${el.tagName.toLowerCase()}#${el.id || i} in [data-sample=${id}]`];
    });
  });
}
