// Builds release data for one product from its channel spec and its docs.
// `read(path)` returns a file at the pinned commit (local git or a release tag).
import { createHash } from 'node:crypto';
import {
  CHANNEL_LABELS,
  CHANNEL_ORDER,
  type ChannelSpec,
  type ProductSpec,
  type Source,
} from '../../config/install-channels.ts';
import { releaseDataSchema, type Release, type ReleaseData } from '../../src/lib/releases.ts';
import { codeBlocks, commands, inlineCode, templatize } from './install-docs.ts';

export const sha256 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex');

export function extract(
  spec: ProductSpec,
  source: Source,
  read: (path: string) => string,
  arch: ChannelSpec['arch'],
): string[] {
  const file = source.kind === 'literal' ? source.file : (source.file ?? spec.docs);
  if (!file) throw new Error(`${spec.repo}: no file for ${source.kind} source`);
  const text = read(file);
  let cmds: string[];
  if (source.kind === 'inline') cmds = [inlineCode(text, source.startsWith)];
  else if (source.kind === 'block') {
    const block = codeBlocks(text, source.heading)[source.index];
    if (!block)
      throw new Error(`${spec.repo}:${file}: no block ${source.index} under "${source.heading}"`);
    cmds = commands(block, {
      ...(source.from ? { from: source.from } : {}),
      ...(source.keep ? { keep: source.keep } : {}),
    });
  } else {
    for (const needle of source.mustContain) {
      if (!text.includes(needle))
        throw new Error(`${spec.repo}:${file} no longer contains: ${needle}`);
    }
    cmds = source.commands;
  }
  if (cmds.length === 0)
    throw new Error(`${spec.repo}: ${JSON.stringify(source)} yielded no commands`);
  return cmds.map((c) => templatize(c, spec.exampleVersion, arch));
}

export function buildReleaseData(opts: {
  spec: ProductSpec;
  read: (path: string) => string;
  ref: string;
  commit: string;
  release: Release | null;
  scripts: Record<string, { path: string; content: Buffer }>;
}): ReleaseData {
  const { spec, read } = opts;
  const channels = [...spec.channels]
    .sort((a, b) => CHANNEL_ORDER.indexOf(a.id) - CHANNEL_ORDER.indexOf(b.id))
    // a script channel exists only when its script is served
    .filter((c) =>
      c.id === 'script'
        ? 'install.sh' in opts.scripts
        : c.id === 'powershell'
          ? 'install.ps1' in opts.scripts
          : true,
    )
    .map((c) => ({
      id: c.id,
      label: CHANNEL_LABELS[c.id],
      os: c.os,
      commands: c.source ? extract(spec, c.source, read, c.arch) : [],
      ...(c.id === 'releases'
        ? { link: `https://github.com/rajasatyajit/${spec.repo}/releases/tag/{tag}` }
        : {}),
      what: c.what,
      whatCite: c.whatCite,
      ...(c.verify
        ? {
            verify: {
              text: c.verify.text,
              cite: c.verify.cite,
              commands: c.verify.source ? extract(spec, c.verify.source, read, c.arch) : [],
            },
          }
        : {}),
    }));
  return releaseDataSchema.parse({
    product: spec.repo,
    name: spec.name,
    binary: spec.binary,
    source: { repo: spec.repo, ref: opts.ref, commit: opts.commit },
    release: opts.release,
    next: spec.next.map(({ cmd, note }) => (note ? { cmd, note } : { cmd })),
    scripts: Object.fromEntries(
      Object.entries(opts.scripts).map(([name, s]) => [
        name,
        { path: s.path, sha256: sha256(s.content), bytes: s.content.length },
      ]),
    ),
    channels,
  });
}
