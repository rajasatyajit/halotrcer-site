// Rules shared by the dist checks; unit-tested in tests/unit/rules.test.ts.

export function parseHeaders(text: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = new Map();
      rules.set(line.trim(), current);
    } else if (current) {
      const i = line.indexOf(':');
      current.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
    }
  }
  return rules;
}

export const FORBIDDEN: [RegExp, string][] = [
  [/curl\s+-[a-zA-Z]*\s+https?:\/\//, 'curl install command'],
  [/\birm\s+https?:\/\//, 'PowerShell install command'],
  [/\|\s*(sh|bash|iex)\b/, 'pipe-to-shell command'],
  [/\bbrew install\b/, 'Homebrew command'],
  [/\bwinget install\b/, 'winget command'],
  [/\bscoop (install|bucket)\b/, 'Scoop command'],
  [/\bapt(-get)? install\b/, 'apt command'],
  [/\b(dnf|yum) install\b/, 'dnf/yum command'],
  [/\bapk add\b/, 'apk command'],
  [/\bdocker (run|pull)\b/, 'Docker command'],
  [/\bhelm (install|upgrade)\b/, 'Helm command'],
  [/\bgo install\b/, 'go install command'],
  [/ghcr\.io\/rajasatyajit/, 'container image reference'],
  [/github\.com\/rajasatyajit/i, 'GitHub link'],
  [/\bv?\d+\.\d+\.\d+(-[\w.]+)?\b/, 'version number'],
  [/github-buttons|stargazers|ghbtns|star-button|data-github-stars/i, 'star button'],
];

export const RULES: [RegExp, string][] = [
  [/\$\s?\d/, 'dollar amount'],
  [
    /\d[\d,.]*\s?(%|percent\b|×|x\b|ms\b|µs\b|us\b|seconds?\b|s\b|k\b|K\b|M\b|million\b|billion\b)/,
    'metric or percentage',
  ],
  [
    /\b\d[\d,.]*\+?\s+(customers?|clients?|users?|teams?|companies|stars?|downloads?|installs?|engineers?|developers?|organi[sz]ations?)\b/i,
    'count',
  ],
  [
    /\b(trusted by|used by|loved by|customers include|clients include|as seen (in|on)|join (over|more than)?\s*\d)/i,
    'customer-proof phrasing',
  ],
];

export function findViolations(text: string): string[] {
  return RULES.flatMap(([re, what]) => {
    const m = re.exec(text);
    return m
      ? [`${what}: "${text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).trim()}"`]
      : [];
  });
}
