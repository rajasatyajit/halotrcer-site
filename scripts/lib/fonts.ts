// The only font files the sites may ship: the three Case File faces (owner decision
// 2026-10-23), as hashed WOFF2 files that Astro emits into _astro/.
export const FONTS = ['permanent-marker', 'special-elite', 'karla'] as const;

const ALLOWED = new RegExp(`(^|[/\\\\])_astro[/\\\\](${FONTS.join('|')})\\.[\\w-]+\\.woff2$`);

export const isAllowedFont = (path: string): boolean => ALLOWED.test(path);
