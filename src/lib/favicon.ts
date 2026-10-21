// SVG monogram favicon per host: a letter on the host's brand colour.
const COLORS = { www: '#3b3fb6', tokvera: '#8a4b00', sievant: '#0b6b63' } as const;

export function faviconSvg(site: keyof typeof COLORS): string {
  const letter = { www: 'H', tokvera: 'T', sievant: 'S' }[site];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${COLORS[site]}"/><text x="16" y="22.5" font-family="system-ui,sans-serif" font-size="19" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`;
}
