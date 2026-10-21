// Canonical path for a built page: "/index" -> "/", "/docs/index.html" -> "/docs", "/audit/" -> "/audit".
export function canonicalPath(pathname: string): string {
  const p = pathname
    .replace(/\.html$/, '')
    .replace(/(^|\/)index$/, '')
    .replace(/\/+$/, '');
  return p === '' ? '/' : p.startsWith('/') ? p : `/${p}`;
}
