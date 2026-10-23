// The case boards' content, computed from the synced sample reports. Every number on a
// clue card comes from here; src/data/boards.ts holds only the words.
import { url, type SiteId } from '../config/site.ts';
import { BOARDS, CLUES, KINDS, SUMMARY } from '../data/boards.ts';
import { sample } from './samples.ts';

export type SampleId = 'tokvera-scan' | 'sievant-posture';

export interface Clue {
  kind: string;
  title: string;
  body: string;
  tool: 'Tokvera' | 'Sievant';
  detail?: string;
  sample: SampleId;
  href: string;
}

export interface Board {
  label: string;
  subject: { title: string; body: string };
  tag: string;
  sticky: string;
  clues: Clue[];
  summary: string;
  sources: { tool: string; path: string }[];
}

interface Level {
  concurrency: number;
  ttft_ms: { p99: number };
  status_counts?: Record<string, number>;
}
interface TokveraScan {
  run: { requests: number; failed: number };
  levels: Level[];
  cache: { prompts: number; distinct: number };
  score: { grade: string; points: number };
}
interface SievantPosture {
  organization: string;
  architecture: { client_servers: { name: string; through_sievant: boolean }[] };
  activity: {
    requests: number;
    blocked: number;
    output_redactions: number;
    events: { name: string; count: number }[];
    top_blocked: { name: string; count: number }[];
  };
}

function tokvera() {
  const { data, source } = sample<TokveraScan>('tokvera-scan');
  const first = data.levels[0];
  const last = data.levels.at(-1);
  // "One request at a time" is only true if the run starts at concurrency 1.
  if (!first || !last || first.concurrency !== 1) throw new Error('tokvera-scan: no level 1');
  const codes = new Map<string, number>();
  for (const level of data.levels)
    for (const [code, n] of Object.entries(level.status_counts ?? {}))
      codes.set(code, (codes.get(code) ?? 0) + n);
  const v = {
    repeats: data.cache.prompts - data.cache.distinct,
    prompts: data.cache.prompts,
    idle: first.ttft_ms.p99,
    peak: last.ttft_ms.p99,
    level: last.concurrency,
    failed: data.run.failed,
    requests: data.run.requests,
    codes: [...codes].map(([code, n]) => CLUES.failed.code(code, n)).join(', '),
    grade: data.score.grade,
    points: data.score.points,
  };
  const base = {
    tool: 'Tokvera',
    sample: 'tokvera-scan',
    href: url('tokvera', '/sample-report'),
  } as const;
  const repeated: Clue = {
    ...base,
    kind: KINDS.suspect(1),
    title: CLUES.repeated.title,
    body: CLUES.repeated.body(v.repeats, v.prompts),
  };
  const rush: Clue = {
    ...base,
    kind: KINDS.suspect(2),
    title: CLUES.rush.title,
    body: CLUES.rush.body(v.idle, v.peak, v.level),
    detail: CLUES.rush.detail,
  };
  const failed: Clue = {
    ...base,
    kind: KINDS.evidence,
    title: CLUES.failed.title(v.failed, v.requests),
    body: CLUES.failed.body(v.codes),
  };
  const grade: Clue = {
    ...base,
    kind: KINDS.verdict,
    title: CLUES.grade.title(v.grade),
    body: CLUES.grade.body(v.points),
  };
  return { v, source, repeated, rush, failed, grade };
}

function sievant() {
  const { data, source } = sample<SievantPosture>('sievant-posture');
  const servers = data.architecture.client_servers;
  const bypassing = servers.filter((s) => !s.through_sievant);
  const wrapped = servers.find((s) => s.through_sievant);
  const top = data.activity.top_blocked[0];
  if (!bypassing[0] || !wrapped || !top) throw new Error('sievant-posture: missing servers');
  const v = {
    servers: servers.length,
    bypassing: bypassing.length,
    credentials: data.activity.events.find((e) => e.name === 'CREDENTIAL_BLOCKED')?.count ?? 0,
    blocked: data.activity.blocked,
    requests: data.activity.requests,
    redacted: data.activity.output_redactions,
  };
  const base = {
    tool: 'Sievant',
    sample: 'sievant-posture',
    href: url('sievant', '/sample-report'),
  } as const;
  const bypass: Clue = {
    ...base,
    kind: KINDS.accomplice,
    title: CLUES.bypass.title(bypassing[0].name),
    body: CLUES.bypass.body,
  };
  const credential: Clue = {
    ...base,
    kind: KINDS.caught,
    title: CLUES.credential.title,
    body: CLUES.credential.body(v.credentials, v.credentials !== 1),
  };
  const checkpoint: Clue = {
    ...base,
    kind: KINDS.alibi,
    title: CLUES.checkpoint.title,
    body: CLUES.checkpoint.body(v.blocked, v.requests, v.redacted),
  };
  const alibi: Clue = {
    ...base,
    kind: KINDS.alibi,
    title: CLUES.wrapped.title(wrapped.name),
    body: CLUES.wrapped.body,
  };
  const blocked: Clue = {
    ...base,
    kind: KINDS.evidence,
    title: CLUES.blocked.title(v.blocked, v.requests),
    body: CLUES.blocked.body(top.name, top.count),
  };
  return {
    v,
    source,
    organization: data.organization,
    bypass,
    credential,
    checkpoint,
    alibi,
    blocked,
  };
}

export function board(site: SiteId): Board {
  const t = tokvera();
  const s = sievant();
  const tSource = { tool: 'Tokvera', path: t.source.path };
  const sSource = { tool: 'Sievant', path: s.source.path };
  switch (site) {
    case 'www': {
      const b = BOARDS.www;
      const findings = [
        SUMMARY.repeated(t.v.repeats, t.v.prompts),
        SUMMARY.rush(t.v.idle, t.v.peak),
        SUMMARY.failed(t.v.failed, t.v.requests),
        SUMMARY.bypass(s.v.bypassing, s.v.servers, 'security'),
      ].join(', ');
      return {
        label: b.label,
        subject: b.subject,
        tag: b.tag,
        sticky: b.sticky,
        clues: [t.repeated, t.rush, t.failed, s.bypass, s.credential, s.checkpoint],
        summary: b.summary(findings, url('www', '/')),
        sources: [tSource, sSource],
      };
    }
    case 'tokvera': {
      const b = BOARDS.tokvera;
      const findings = [
        SUMMARY.repeated(t.v.repeats, t.v.prompts),
        SUMMARY.rush(t.v.idle, t.v.peak),
        SUMMARY.failed(t.v.failed, t.v.requests),
        SUMMARY.grade(t.v.grade),
      ].join(', ');
      return {
        label: b.label,
        subject: b.subject,
        tag: b.tag,
        sticky: b.sticky,
        clues: [t.repeated, t.rush, t.failed, t.grade],
        summary: b.summary(findings, url('tokvera', '/')),
        sources: [tSource],
      };
    }
    case 'sievant': {
      const b = BOARDS.sievant;
      const findings = [
        SUMMARY.bypass(s.v.bypassing, s.v.servers, 'Sievant'),
        SUMMARY.blocked(s.v.blocked, s.v.requests),
        SUMMARY.credential(s.v.credentials, s.v.credentials !== 1),
      ].join(', ');
      return {
        label: b.label,
        subject: b.subject,
        tag: b.tag(s.organization),
        sticky: b.sticky,
        clues: [s.bypass, s.credential, s.alibi, s.blocked],
        summary: b.summary(findings, url('sievant', '/')),
        sources: [sSource],
      };
    }
  }
}

// Board slots run 0–8, row by row; 4 is the subject in the centre.
const SLOTS: Record<number, number[]> = { 6: [0, 2, 3, 5, 6, 8], 4: [0, 2, 6, 8] };
export const TAG_SLOT = 1;
export const STICKY_SLOT = 7;
export const CENTRE = 4;

export function clueSlots(count: number): number[] {
  const slots = SLOTS[count];
  if (!slots) throw new Error(`a board holds 4 or 6 clues, not ${count}`);
  return slots;
}

// Yarn in a 1000×600 viewBox: one line from the centre to each clue slot's centre.
const X = [167, 500, 833];
const Y = [100, 300, 500];
export function yarnLines(slots: number[]): { x1: number; y1: number; x2: number; y2: number }[] {
  return slots.map((slot) => ({
    x1: 500,
    y1: 300,
    x2: X[slot % 3] ?? 500,
    y2: Y[Math.floor(slot / 3)] ?? 300,
  }));
}
