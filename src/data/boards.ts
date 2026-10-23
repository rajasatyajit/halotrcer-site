// The words on the case boards: DESIGN.md's approved copy, with the owner's corrections.
// No numbers here: src/lib/clues.ts reads every value from content/samples and passes it in
// (tests/unit/boards.test.ts fails on any digit but case numbers and percentile names).

type N = number | string;

// Each clue has a figure (the key number, set large) and a sentence that explains it.
export const CLUES = {
  repeated: {
    title: 'Repeated prompts',
    figure: (repeats: N, prompts: N) => `${repeats} of ${prompts}`,
    body: (repeats: N, prompts: N) =>
      `${repeats} of ${prompts} prompts repeat an earlier one exactly. If that is what reaches the model, each repeat is paid for again.`,
  },
  rush: {
    title: 'Rush hour',
    figure: (idle: N, peak: N) => `${idle} → ${peak} ms`,
    body: (idle: N, peak: N, level: N) =>
      `First token, p99: ${idle} ms one request at a time, ${peak} ms with ${level} requests at once.`,
    detail: 'p99',
  },
  failed: {
    title: 'Failed requests',
    figure: (failed: N, requests: N) => `${failed} of ${requests}`,
    body: (codes: string) => `${codes}: turned away at the door.`,
    code: (status: N, count: N) => `HTTP ${status} ×${count}`,
  },
  grade: {
    title: 'Grade',
    figure: (grade: string) => grade,
    // Tokvera's label, verbatim.
    body: (points: N) => `${points} points. Provisional scoring.`,
  },
  bypass: {
    title: (name: string) => `MCP server “${name}”`,
    figure: (n: N, of: N) => `${n} of ${of}`,
    body: 'MCP servers on this machine that skip Sievant: no policy, no redaction, no audit.',
  },
  credential: {
    title: 'Credential in arguments',
    figure: (count: N) => `${count} blocked`,
    body: (plural: boolean) =>
      plural
        ? 'Sievant stopped the calls before they reached the tool.'
        : 'Sievant stopped the call before it reached the tool.',
  },
  checkpoint: {
    title: 'Behind the checkpoint',
    figure: (blocked: N, requests: N) => `${blocked} of ${requests}`,
    body: (redacted: N) => `Calls through Sievant that were blocked; ${redacted} results redacted.`,
  },
  wrapped: {
    title: (name: string) => `MCP server “${name}”`,
    figure: (n: N, of: N) => `${n} of ${of}`,
    body: 'MCP servers on this machine that run through Sievant.',
  },
  blocked: {
    title: 'Tool calls blocked',
    figure: (blocked: N, requests: N) => `${blocked} of ${requests}`,
    body: (tool: string, count: N) => `Top blocked tool: ${tool} (${count}).`,
  },
};

export const KINDS = {
  suspect: (n: N) => `Suspect #${n}`,
  evidence: 'Evidence',
  accomplice: 'Accomplice',
  caught: 'Caught',
  alibi: 'Alibi',
  verdict: 'Verdict',
};

export const BOARDS = {
  www: {
    label: 'Detective board: findings from simulated demo runs',
    subject: { title: 'Your AI', body: 'Slow, expensive or leaking? All three leave fingerprints.' },
    tag: 'Case HAL-001 · simulated demo runs · fictional systems',
    sticky: 'Detectives on this case: Tokvera + Sievant.',
    summary: (findings: string, link: string) =>
      `Case file on my AI (simulated demo runs): ${findings}. Who's draining yours? ${link}`,
  },
  tokvera: {
    label: 'Detective board: findings from a simulated Tokvera run',
    subject: { title: 'Your LLM endpoint', body: 'Slow, failing or expensive? Each leaves a trace.' },
    tag: "Case TOK-001 · Tokvera's built-in simulator · simulated demo run",
    sticky: 'Detective on this case: Tokvera.',
    summary: (findings: string, link: string) =>
      `Case file on my LLM endpoint (simulated demo run): ${findings}. Who's draining yours? ${link}`,
  },
  sievant: {
    label: 'Detective board: findings from a simulated Sievant report',
    subject: { title: "Your agents' tools", body: 'What can your agents reach, and who is watching?' },
    tag: (organization: string) =>
      `Case SIE-001 · ${organization} · simulated demo run · fictional system`,
    sticky: 'Detective on this case: Sievant.',
    summary: (findings: string, link: string) =>
      `Case file on my agents' tools (simulated demo run): ${findings}. What are yours exposed to? ${link}`,
  },
};

// Short forms for the copied case file.
export const SUMMARY = {
  repeated: (repeats: N, prompts: N) => `${repeats} of ${prompts} prompts repeated`,
  rush: (idle: N, peak: N) => `first token ${idle} → ${peak} ms under load`,
  failed: (failed: N, requests: N) => `${failed} of ${requests} requests failed`,
  grade: (grade: string) => `grade ${grade} (Provisional scoring.)`,
  bypass: (n: N, of: N, who: string) => `${n} of ${of} MCP servers bypassing ${who}`,
  blocked: (blocked: N, requests: N) => `${blocked} of ${requests} tool calls blocked`,
  credential: (count: N, plural: boolean) =>
    `${count} credential${plural ? 's' : ''} caught in arguments`,
};
