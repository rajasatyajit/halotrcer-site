import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { gluedExpressions, gluedWords } from '../../scripts/lib/glue.ts';

const check = (html: string) => gluedWords(parse(`<body>${html}</body>`));

describe('gluedWords', () => {
  it('flags a claim glued to the word before it ("measurewhether")', () => {
    expect(
      check('<p>Run Tokvera to measure<span data-claim="x">whether repeated prompts</span>.</p>'),
    ).toEqual(['"n Tokvera to measure<span[data-claim]>whether repeated pro"']);
  });

  it('flags a claim glued to the word after it', () => {
    expect(check('<p>Both <span data-claim="x">are Apache-2.0</span>today.</p>')).toHaveLength(1);
  });

  it('flags a link or emphasis glued inside a sentence', () => {
    expect(check('<p>the engagements on the<a href="/p">pricing page</a> are open</p>')).toEqual([
      '"e engagements on the<a>pricing page"',
    ]);
    expect(check('<li>(tagged<em>deal risk</em>)</li>')).toHaveLength(1);
  });

  it('passes the same sentences with the space restored', () => {
    expect(
      check('<p>Run Tokvera to measure <span data-claim="x">whether repeated prompts</span>.</p>'),
    ).toEqual([]);
    expect(check('<p>on the <a href="/p">pricing page</a> are open</p>')).toEqual([]);
  });

  it('passes punctuation beside an element', () => {
    expect(check('<p>(<em>deal risk</em>), see <a href="/s">scoring</a>.</p>')).toEqual([]);
  });

  it('skips layout: nav links, a block beside the element, classed pieces, case tags', () => {
    expect(check('<nav><a href="/">Home</a><a href="/p">Pricing</a></nav>')).toEqual([]);
    expect(check('<li><span>partial</span><p>Mode enforce</p></li>')).toEqual([]);
    expect(check('<p><strong class="badge">Simulated demo run</strong>Real output</p>')).toEqual(
      [],
    );
    expect(check('<p class="case-tag"><b>Case HAL-001</b>simulated demo runs</p>')).toEqual([]);
    expect(
      check('<p><span>Scan your endpoint</span><span class="note">From the README</span></p>'),
    ).toEqual([]);
  });

  it('skips code blocks and synced product docs', () => {
    expect(check('<pre><code>a</code>b</pre>')).toEqual([]);
    expect(check('<div data-source-doc="x"><p><code>$ref</code>s are resolved</p></div>')).toEqual(
      [],
    );
  });
});

describe('gluedExpressions', () => {
  const page = (body: string) => `---\nconst launched = false;\n---\n\n${body}\n`;

  it('flags a word followed by an expression on the next line ("Sievantwill")', () => {
    expect(
      gluedExpressions(
        page(
          "<p>\n  Tokvera and Sievant\n  {launched ? 'are both' : 'will both be'} Apache-2.0.\n</p>",
        ),
      ),
    ).toEqual([
      { line: 7, text: "Tokvera and Sievant ⏎ {launched ? 'are both' : 'will both be'}" },
    ]);
  });

  it("passes the same lines with {' '}", () => {
    expect(
      gluedExpressions(
        page(
          "<p>\n  Tokvera and Sievant{' '}\n  {launched ? 'are both' : 'will both be'} Apache-2.0.\n</p>",
        ),
      ),
    ).toEqual([]);
    expect(gluedExpressions(page("<p>\n  and\n  {' '}<a href={x}>Sievant</a>\n</p>"))).toEqual([]);
  });

  it('ignores the frontmatter, comments and lines ending in markup', () => {
    expect(gluedExpressions('---\nconst a = b\n{c}\n---\n<p>x</p>')).toEqual([]);
    expect(gluedExpressions(page('<p>Some text\n  {/* note */}\n</p>'))).toEqual([]);
    expect(gluedExpressions(page('<div>\n  {launched && <p>x</p>}\n</div>'))).toEqual([]);
  });
});
