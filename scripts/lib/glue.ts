// Astro can drop the line break between a word and what starts the next line, so
// "measure\n<Claim …/>" renders as "measure<span data-claim>whether" and "Sievant\n{launched ? …}"
// as "Sievantwill". {' '} fixes both. Two checks, unit-tested in tests/unit/glue.test.ts and run
// by scripts/check-glue.ts:
// - gluedWords: in the built HTML, an inline element whose text touches a letter or digit beside
//   it, inside prose;
// - gluedExpressions: in an .astro template, a line ending in a word followed by a line that
//   starts with an expression. Text joined to an expression's text leaves no element boundary
//   in the HTML, so only the source shows it.
import { NodeType, type HTMLElement, type Node } from 'node-html-parser';

// Inline elements a sentence is built from.
const INLINE = 'a, span, code, strong, em, b, i, abbr, time, kbd, mark, small, q, cite';
const INLINE_TAGS = new Set(INLINE.toUpperCase().split(', '));
// Only prose: links in a nav or buttons in a row sit side by side by layout, not by a space.
const PROSE = new Set(
  'P LI TD TH DD DT FIGCAPTION CAPTION BLOCKQUOTE SUMMARY LEGEND LABEL H1 H2 H3 H4 H5 H6'.split(
    ' ',
  ),
);
// Not checked: code and SVG text; synced product docs (verbatim, e.g. "<code>$ref</code>s");
// classed pieces (stamps, badges, versions, prices) and .case-tag b, which the CSS lays out
// apart. A static check can't see CSS, so these are named here instead.
const SKIP = 'pre, script, style, svg, [data-source-doc]';
const LAID_OUT = (el: HTMLElement): boolean =>
  el.hasAttribute('class') ||
  (el.tagName === 'B' && !!el.parentNode?.classList?.contains('case-tag'));
const WORD = /[\p{L}\p{N}]/u;

// The nearest block ancestor is a prose container (inline wrappers in between are fine).
const inProse = (el: HTMLElement): boolean => {
  for (let p = el.parentNode; p; p = p.parentNode) {
    if (PROSE.has(p.tagName)) return true;
    if (!INLINE_TAGS.has(p.tagName)) return false;
  }
  return false;
};

const inSkipped = (el: HTMLElement): boolean => {
  for (let p: HTMLElement | null = el; p; p = p.parentNode) if (p.matches?.(SKIP)) return true;
  return false;
};

const text = (n: Node): string => (n.nodeType === NodeType.COMMENT_NODE ? '' : n.text);

// The text beside el on one side, up to a block (or <br>) or a laid-out piece, which the line
// breaks or the CSS spaces anyway.
function neighbour(el: HTMLElement, step: -1 | 1): string {
  const sibs = el.parentNode?.childNodes ?? [];
  const at = sibs.indexOf(el);
  const side = step < 0 ? sibs.slice(0, at).reverse() : sibs.slice(at + 1);
  for (const sib of side) {
    if (sib.nodeType === NodeType.ELEMENT_NODE) {
      const e = sib as HTMLElement;
      if (!INLINE_TAGS.has(e.tagName) || LAID_OUT(e)) return '';
    }
    const t = text(sib);
    if (t !== '') return t;
  }
  return '';
}

export function gluedWords(root: HTMLElement): string[] {
  return root.querySelectorAll(INLINE).flatMap((el) => {
    if (LAID_OUT(el) || inSkipped(el) || !inProse(el)) return [];
    const inner = el.text;
    if (inner.trim() === '') return [];
    const before = neighbour(el, -1);
    const after = neighbour(el, 1);
    const tag = el.tagName.toLowerCase() + (el.hasAttribute('data-claim') ? '[data-claim]' : '');
    const out: string[] = [];
    if (WORD.test(before.at(-1) ?? '') && WORD.test(inner[0] ?? ''))
      out.push(`"${before.slice(-20).trimStart()}<${tag}>${inner.slice(0, 20)}"`);
    if (WORD.test(inner.at(-1) ?? '') && WORD.test(after[0] ?? ''))
      out.push(`"${inner.slice(-20)}</${tag}>${after.slice(0, 20).trimEnd()}"`);
    return out;
  });
}

export interface SourceGlue {
  line: number;
  text: string;
}

// Lines are 1-based. Only the template (after the frontmatter) is read; {/* comments */} and
// {' '} itself are not expressions that glue.
export function gluedExpressions(source: string): SourceGlue[] {
  const lines = source.split('\n');
  const fences = lines.flatMap((l, i) => (l.trim() === '---' ? [i] : []));
  const start = fences[1] === undefined ? 0 : fences[1] + 1;
  const out: SourceGlue[] = [];
  lines.forEach((line, i) => {
    if (i <= start) return;
    const prev = (lines[i - 1] ?? '').trimEnd();
    const cur = line.trimStart();
    if (!WORD.test(prev.at(-1) ?? '') || !cur.startsWith('{')) return;
    if (cur.startsWith("{' '}") || cur.startsWith('{/*')) return;
    out.push({ line: i + 1, text: `${prev.trim().slice(-30)} ⏎ ${cur.slice(0, 40)}` });
  });
  return out;
}
