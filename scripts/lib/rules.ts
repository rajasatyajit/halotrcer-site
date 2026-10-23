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
      // "! Name" detaches a header set by an earlier rule (Cloudflare Pages); kept as "!name".
      const detach = /^\s*!\s*(\S+)\s*$/.exec(line);
      if (detach?.[1]) {
        current.set(`!${detach[1].toLowerCase()}`, '');
        continue;
      }
      const i = line.indexOf(':');
      current.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
    }
  }
  return rules;
}

export const FORBIDDEN: [RegExp, string][] = [
  [/curl\s+-[a-zA-Z]*\s+https?:\/\//, 'curl install command'],
  [/\birm\s+https?:\/\//, 'PowerShell install command'],
  // A URL piped to a shell. "curl … | sh" quoted as a risk (Sievant's SUP002 rule) is not a command.
  [/https?:\/\/\S+\s*\|\s*(sh|bash|iex)\b/, 'pipe-to-shell command'],
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
  // Release versions only. A scoring-model version ("ranking model is at
  // version 0.1.0") is documentation, not a release, and is allowed.
  [/\bv\d+\.\d+\.\d+\b/, 'release version (vX.Y.Z)'],
  [/\b(tokvera|sievant|halotrcer)[\s_@-]+v?\d+\.\d+\.\d+/i, 'product release version'],
  [/\b\d+\.\d+\.\d+-(rc|alpha|beta)\b/i, 'pre-release version'],
  [/github-buttons|stargazers|ghbtns|star-button|data-github-stars/i, 'star button'],
  // GitHub's private vulnerability reporting needs the public repository: before launch the
  // only reporting route is email (owner decision O3, 2026-10-22).
  [/private vulnerability reporting/i, 'GitHub vulnerability reporting'],
];

// True when a text shows nothing that must wait for launch.
export const passesPrelaunch = (text: string): boolean => FORBIDDEN.every(([re]) => !re.test(text));

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
