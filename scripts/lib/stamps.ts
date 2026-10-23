// Sample labels travel with what gets cropped: every clue card, and every table and section inside a
// [data-sample] region must carry its own [data-stamp]. Unit-tested in
// tests/unit/stamps.test.ts; run on the built pages by scripts/check-stamps.ts.
import type { HTMLElement } from 'node-html-parser';

// A stamp counts only if it says something: an empty or whitespace-only [data-stamp] is no label.
const hasStamp = (el: HTMLElement | null | undefined): boolean =>
  !!el?.querySelectorAll('[data-stamp]').some((st) => st.textContent.trim() !== '');

export function missingStamps(root: HTMLElement): string[] {
  // Every clue card carries its own stamp, wherever it sits (DESIGN.md §4).
  const clues = root
    .querySelectorAll('[data-clue]')
    .flatMap((card, i) => (hasStamp(card) ? [] : [`clue#${i}`]));
  // data-simulated="false" marks sourced data that is not a demo run (the OWASP mapping).
  const frames = root
    .querySelectorAll('[data-sample]:not([data-simulated="false"])')
    .flatMap((region) => {
      const id = region.getAttribute('data-sample') ?? '?';
      return region.querySelectorAll('table, section').flatMap((el, i) => {
        const where = el.tagName === 'TABLE' ? el.querySelector('caption') : el;
        if (hasStamp(where)) return [];
        return [`${el.tagName.toLowerCase()}#${el.id || i} in [data-sample=${id}]`];
      });
    });
  return [...clues, ...frames];
}
