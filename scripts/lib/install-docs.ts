// Extracts install commands verbatim from a product's markdown docs. Pure
// functions: the same code runs on docs read locally (git show) and on docs
// fetched from a release tag at build time.

interface Section {
  heading: string;
  level: number;
  lines: string[];
}

// Splits markdown into sections by heading, ignoring "#" lines inside code fences.
export function sections(md: string): Section[] {
  const out: Section[] = [{ heading: '', level: 0, lines: [] }];
  let fenced = false;
  for (const line of md.split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const h = fenced ? null : /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (h?.[1] && h[2]) out.push({ heading: h[2], level: h[1].length, lines: [] });
    else out.at(-1)?.lines.push(line);
  }
  return out;
}

// Code blocks under a heading (and its subsections), each as its lines.
export function codeBlocks(md: string, heading: string): string[][] {
  const all = sections(md);
  const start = all.findIndex((s) => s.heading.replace(/`/g, '') === heading);
  if (start < 0) throw new Error(`heading "${heading}" not found`);
  const level = all[start]?.level ?? 0;
  const lines: string[] = [];
  for (let i = start; i < all.length; i++) {
    const s = all[i];
    if (!s || (i > start && s.level <= level)) break;
    lines.push(...s.lines);
  }
  const blocks: string[][] = [];
  let current: string[] | undefined;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (current) {
        blocks.push(current);
        current = undefined;
      } else current = [];
    } else current?.push(line);
  }
  return blocks;
}

// The first inline code span that starts with `prefix` (table cells escape "|" as "\|").
export function inlineCode(md: string, prefix: string): string {
  for (const m of md.matchAll(/`([^`\n]+)`/g)) {
    const code = (m[1] ?? '').replace(/\\\|/g, '|');
    if (code.startsWith(prefix)) return code;
  }
  throw new Error(`no inline code starting with "${prefix}"`);
}

// Groups a block's lines into commands, joining "\" continuations, and keeps
// the commands from the first one matching `from` (all when omitted) while
// they match `keep` (all when omitted).
export function commands(block: string[], opts: { from?: RegExp; keep?: RegExp } = {}): string[] {
  const grouped: string[] = [];
  let pending: string[] = [];
  for (const line of block) {
    if (!line.trim() && pending.length === 0) continue;
    pending.push(line);
    if (!/\\\s*$|\|\s*$/.test(line)) {
      grouped.push(pending.join('\n'));
      pending = [];
    }
  }
  if (pending.length) grouped.push(pending.join('\n'));
  const start = opts.from ? grouped.findIndex((c) => opts.from?.test(c)) : 0;
  if (start < 0) throw new Error(`no command matching ${opts.from}`);
  return grouped.slice(start).filter((c) => !opts.keep || opts.keep.test(c));
}

// Turns a documented example version into placeholders: "v0.2.0" -> {tag},
// "0.2.0" -> {version}. Arch tokens become placeholders resolved per platform.
export function templatize(
  text: string,
  exampleVersion: string,
  archTokens: Record<string, string> = {},
): string {
  const v = exampleVersion.replace(/\./g, '\\.');
  // Digit-aware edges, not \b: "_" is a word character, so \b misses "tokvera_0.2.0_x86_64".
  let out = text
    .replace(new RegExp(`(?<![\\w.])v${v}(?![\\d.])`, 'g'), '{tag}')
    .replace(new RegExp(`(?<![\\d.])${v}(?![\\d.])`, 'g'), '{version}');
  for (const [token, placeholder] of Object.entries(archTokens)) {
    out = out.split(token).join(`{${placeholder}}`);
  }
  return out;
}
