// Which text the built site sets in Permanent Marker. The selectors come from the built CSS
// (rules whose font-family is var(--font-marker)); an element that also matches a rule with
// another face counts as not Marker. Over-collecting is the safe side: it only makes the
// subset larger or the check stricter. Unit-tested in tests/unit/marker.test.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HTMLElement } from 'node-html-parser';
import type { SiteId } from '../../src/config/site.ts';
import { builtSites, DIST, pages, walk } from './dist.ts';

export interface MarkerRules {
  marker: string[];
  plain: string[];
  upper: string[];
}

export function markerRules(css: string): MarkerRules {
  const rules: MarkerRules = { marker: [], plain: [], upper: [] };
  // Innermost rules only: "selectors{declarations}" with no nested braces (at-rule bodies
  // are walked through, since their inner rules match too).
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (m[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(
        (s) => s && !s.startsWith('@') && !s.startsWith(':root') && !/^(from|to|\d+%)$/.test(s),
      );
    const decls = m[2] ?? '';
    const family = /font-family:\s*([^;]+)/.exec(decls)?.[1]?.trim();
    if (family === 'var(--font-marker)') rules.marker.push(...selectors);
    else if (family) rules.plain.push(...selectors);
    if (/text-transform:\s*uppercase/.test(decls)) rules.upper.push(...selectors);
  }
  return rules;
}

const matches = (el: HTMLElement, root: HTMLElement, selectors: string[]) =>
  selectors.some((s) => {
    try {
      return root.querySelectorAll(s).includes(el);
    } catch {
      return false;
    }
  });

export function markerChars(root: HTMLElement, rules: MarkerRules): Set<string> {
  const out = new Set<string>();
  const seen = new Set<HTMLElement>();
  for (const selector of rules.marker) {
    let found: HTMLElement[];
    try {
      found = root.querySelectorAll(selector);
    } catch {
      throw new Error(`marker selector not understood: ${selector}`);
    }
    for (const el of found) {
      if (seen.has(el) || matches(el, root, rules.plain)) continue;
      seen.add(el);
      const text = el.textContent;
      for (const c of text) out.add(c);
      if (matches(el, root, rules.upper)) for (const c of text.toUpperCase()) out.add(c);
    }
  }
  return out;
}

export const missingGlyphs = (chars: Set<string>, subset: string): string[] =>
  [...chars].filter((c) => c.trim() && !subset.includes(c)).sort();

export const markerFailure = (missing: string[]): string =>
  `Marker text uses glyphs outside the subset: ${missing.join(' ')}. Run npm run font:marker to re-cut the font.`;

// Every character the built site in dist/ sets in Marker, per page and in total.
export function distMarkerChars(): { site: SiteId; rel: string; chars: Set<string> }[] {
  return builtSites().flatMap((site) => {
    const css = walk(join(DIST, site))
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const rules = markerRules(css);
    if (rules.marker.length === 0)
      throw new Error(`${site}: no Marker rules found in the built CSS`);
    return pages(site).map((page) => ({
      site,
      rel: page.rel,
      chars: markerChars(page.root, rules),
    }));
  });
}
