// External link checking (nightly): which links to skip and how to read a status.

// Private until launch (PLAN.md §10), and the fixture release used in tests.
export function skipped(href: string, launched: boolean): boolean {
  if (/\/v0\.0\.0-fixture\b/.test(href)) return true;
  return !launched && /^https:\/\/github\.com\/rajasatyajit\//i.test(href);
}

export type Verdict = 'ok' | 'unverified' | 'broken';

// 2xx/3xx: fine. 401/403/429 and a refused HEAD: the site turns away automated
// requests, so the link can't be verified but isn't known to be broken.
// Anything else (404, 410, 5xx after a retry, no response) is broken.
export function verdict(status: number | undefined): Verdict {
  if (status === undefined) return 'broken';
  if (status >= 200 && status < 400) return 'ok';
  if ([401, 403, 429].includes(status)) return 'unverified';
  return 'broken';
}
