// Every value on the case boards, read from the real sample files (DESIGN.md §5: numbers
// come from content/samples, never typed).
import { describe, expect, it } from 'vitest';
import { board, clueSlots, yarnLines } from '../../src/lib/clues.ts';
import { sample } from '../../src/lib/samples.ts';
import { url } from '../../src/config/site.ts';

const text = (site: Parameters<typeof board>[0], title: string) => {
  const c = board(site).clues.find((x) => x.title === title);
  if (!c) throw new Error(`no clue "${title}" on ${site}`);
  return c;
};

describe('www board', () => {
  const b = board('www');

  it('pins six clues in the mockup order', () => {
    expect(b.clues.map((c) => [c.kind, c.title])).toEqual([
      ['Suspect #1', 'Repeated prompts'],
      ['Suspect #2', 'Rush hour'],
      ['Evidence', '5 of 60 requests failed'],
      ['Accomplice', 'MCP server “search”'],
      ['Caught', 'Credential in arguments'],
      ['Alibi', 'Behind the checkpoint'],
    ]);
  });

  it('reads every number from the samples', () => {
    expect(text('www', 'Repeated prompts').body).toBe(
      '16 of 40 prompts repeat an earlier one exactly. If that is what reaches the model, each repeat is paid for again.',
    );
    expect(text('www', 'Rush hour').body).toBe(
      'First token, p99: 11 ms one request at a time, 201 ms with 16 requests at once.',
    );
    expect(text('www', '5 of 60 requests failed').body).toBe(
      'HTTP 429 ×5: turned away at the door.',
    );
    expect(text('www', 'MCP server “search”').body).toBe(
      'Talks to its agent directly: no policy, no redaction, no audit.',
    );
    expect(text('www', 'Credential in arguments').body).toBe('1 call blocked.');
    expect(text('www', 'Behind the checkpoint').body).toBe(
      'Calls through Sievant: 13 of 19 blocked, 3 results redacted.',
    );
  });

  it('agrees with the findings the tools wrote', () => {
    const t = sample<{ findings: { check_id: string; evidence: string }[] }>('tokvera-scan').data;
    const ev = (id: string) => t.findings.find((f) => f.check_id === id)?.evidence ?? '';
    expect(ev('repeat_prompt_share')).toContain('16 of 40 prompts');
    expect(ev('error_rate')).toBe('5 of 60 requests failed (HTTP 429 ×5)');
    expect(ev('ttft_p99_load_ratio')).toBe(
      'p99 201 ms at concurrency 16 against 11 ms at concurrency 1',
    );
  });

  it('labels the case and names its sources', () => {
    expect(b.subject).toEqual({
      title: 'Your AI',
      body: 'Slow, expensive or leaking? All three leave fingerprints.',
    });
    expect(b.tag).toBe('Case HAL-001 · simulated demo runs · fictional systems');
    expect(b.sticky).toBe('Detectives on this case: Tokvera + Sievant.');
    expect(b.sources).toEqual([
      { tool: 'Tokvera', path: 'testdata/fixtures/tokvera-b97e278/demo.report.json' },
      { tool: 'Sievant', path: 'pkg/report/testdata/golden/gateway.json' },
    ]);
    expect(b.summary).toBe(
      `Case file on my AI (simulated demo runs): 16 of 40 prompts repeated, first token 11 → 201 ms under load, 5 of 60 requests failed, 1 of 2 MCP servers bypassing security. Who's draining yours? ${url('www', '/')}`,
    );
  });

  it('links each clue to its sample report', () => {
    expect(b.clues.map((c) => [c.tool, c.sample, c.href])).toEqual([
      ...Array(3).fill(['Tokvera', 'tokvera-scan', url('tokvera', '/sample-report')]),
      ...Array(3).fill(['Sievant', 'sievant-posture', url('sievant', '/sample-report')]),
    ]);
  });
});

describe('product boards', () => {
  it('tokvera: four clues, the grade with its provisional label', () => {
    const b = board('tokvera');
    expect(b.clues.map((c) => c.title)).toEqual([
      'Repeated prompts',
      'Rush hour',
      '5 of 60 requests failed',
      'Grade D',
    ]);
    const grade = text('tokvera', 'Grade D');
    expect([grade.kind, grade.body]).toEqual(['Verdict', '60.8 points. Provisional scoring.']);
    expect(b.subject.title).toBe('Your LLM endpoint');
    expect(b.tag).toBe("Case TOK-001 · Tokvera's built-in simulator · simulated demo run");
    expect(b.sticky).toBe('Detective on this case: Tokvera.');
    expect(b.summary).toContain('grade D (Provisional scoring.)');
    expect(b.summary).toContain(url('tokvera', '/'));
  });

  it('sievant: four clues from the posture report', () => {
    const b = board('sievant');
    expect(b.clues.map((c) => [c.kind, c.title, c.body])).toEqual([
      [
        'Accomplice',
        'MCP server “search”',
        'Talks to its agent directly: no policy, no redaction, no audit.',
      ],
      ['Caught', 'Credential in arguments', '1 call blocked.'],
      ['Alibi', 'MCP server “notes”', 'Runs through Sievant on this machine.'],
      ['Evidence', '13 of 19 tool calls blocked', 'Top blocked tool: admin_delete (12).'],
    ]);
    expect(b.subject.title).toBe("Your agents' tools");
    expect(b.tag).toBe('Case SIE-001 · Example Co · simulated demo run · fictional system');
    expect(b.sticky).toBe('Detective on this case: Sievant.');
    expect(b.summary).toContain('1 of 2 MCP servers bypassing Sievant');
    expect(b.summary).toContain(url('sievant', '/'));
  });
});

describe('layout', () => {
  it('puts six clues around the centre and four in the corners', () => {
    expect(clueSlots(6)).toEqual([0, 2, 3, 5, 6, 8]);
    expect(clueSlots(4)).toEqual([0, 2, 6, 8]);
  });

  it('draws one yarn line from each clue slot to the centre', () => {
    expect(yarnLines([0, 8])).toEqual([
      { x1: 500, y1: 300, x2: 167, y2: 100 },
      { x1: 500, y1: 300, x2: 833, y2: 500 },
    ]);
  });
});
