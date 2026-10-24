// Open Graph images: one 1200x630 PNG per page, rendered at build time from the
// page's title and description (integrations/og.ts). Fonts are used only for
// rendering; nothing is shipped to browsers.
export const ogImagePath = (canonical: string) =>
  `/og${canonical === '/' ? '/index' : canonical}.png`;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Greedy line wrapping by an average glyph width (DejaVu Sans is wide).
export function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > maxChars) {
      lines.push(line.trim());
      line = word;
      if (lines.length === maxLines) break;
    } else line = `${line} ${word}`;
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  if (lines.length === maxLines && text.length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1]?.replace(/\s+\S*$/, '')}…`;
  }
  return lines;
}

const ACCENT = { www: '#a9acff', tokvera: '#f2b35b', sievant: '#5fd0c1' } as const;

// A bordered label drawn top right, so a shared image says what it is
// ("Simulated demo run", "Estimate") even without the page around it.
function stampSvg(text: string, colour: string): string {
  const label = escape(text.toUpperCase());
  // DejaVu Sans Bold capitals at 26px average about 19px.
  const width = Math.round(label.length * 19 + 48);
  const x = 1120 - width;
  return `<rect x="${x}" y="90" width="${width}" height="64" rx="6" fill="none" stroke="${colour}" stroke-width="3"/>
  <text x="${x + 24}" y="133" font-family="DejaVu Sans" font-weight="bold" font-size="26" fill="${colour}">${label}</text>`;
}

export function ogSvg(opts: {
  site: keyof typeof ACCENT;
  siteName: string;
  title: string;
  description: string;
  stamp?: string | undefined;
  // Pricing template: these lines replace the description.
  prices?: { name: string; label: string }[] | undefined;
}): string {
  const title = wrap(opts.title, 26, 3);
  const desc = wrap(opts.description, 58, 3);
  const titleTop = 230;
  const descTop = titleTop + title.length * 72 + 30;
  const body = opts.prices
    ? opts.prices.map(
        (p, i) =>
          `<text x="80" y="${descTop + i * 52}" font-family="DejaVu Sans" font-size="34" fill="#ecebe7">${escape(p.name)}: <tspan font-weight="bold" fill="${ACCENT[opts.site]}">${escape(p.label)}</tspan></text>`,
      )
    : desc.map(
        (l, i) =>
          `<text x="80" y="${descTop + i * 42}" font-family="DejaVu Sans" font-size="30" fill="#a6a39c">${escape(l)}</text>`,
      );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#121315"/>
  <rect x="0" y="0" width="1200" height="12" fill="${ACCENT[opts.site]}"/>
  <text x="80" y="140" font-family="DejaVu Sans" font-weight="bold" font-size="40" fill="${ACCENT[opts.site]}">${escape(opts.siteName)}</text>
  ${title.map((l, i) => `<text x="80" y="${titleTop + i * 72}" font-family="DejaVu Sans" font-weight="bold" font-size="60" fill="#ecebe7">${escape(l)}</text>`).join('\n  ')}
  ${body.join('\n  ')}
  ${opts.stamp ? stampSvg(opts.stamp, ACCENT[opts.site]) : ''}
  <text x="80" y="580" font-family="DejaVu Sans" font-size="26" fill="#a6a39c">halotrcer.com</text>
</svg>`;
}
