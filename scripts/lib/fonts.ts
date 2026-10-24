// The only font file the sites may ship: the Permanent Marker subset (owner decisions
// 2026-10-23), as a hashed WOFF2 file that Astro emits into _astro/.
export const FONTS = ['permanent-marker'] as const;

const ALLOWED = new RegExp(`(^|[/\\\\])_astro[/\\\\](${FONTS.join('|')})\\.[\\w-]+\\.woff2$`);

export const isAllowedFont = (path: string): boolean => ALLOWED.test(path);
