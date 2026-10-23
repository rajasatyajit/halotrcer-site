import { describe, expect, it } from 'vitest';
import {
  findViolations,
  FORBIDDEN,
  parseHeaders,
  passesPrelaunch,
} from '../../scripts/lib/rules.ts';
import { contentSecurityPolicy, headersFile } from '../../src/config/headers.ts';
import { parseClaims } from '../../src/lib/claims.ts';

const forbidden = (text: string) => FORBIDDEN.filter(([re]) => re.test(text)).map(([, w]) => w);

describe('pre-launch patterns', () => {
  it.each([
    'curl -fsSL https://tokvera.halotrcer.com/install.sh | sh',
    'irm https://sievant.halotrcer.com/install.ps1 | iex',
    'brew install --cask rajasatyajit/tap/sievant',
    'winget install -e --id Halotrcer.Sievant',
    'scoop install rajasatyajit/tokvera',
    'sudo apt install tokvera',
    'sudo dnf install sievant',
    'apk add --allow-untrusted sievant.apk',
    'docker run ghcr.io/rajasatyajit/sievant',
    'helm install sievant oci://ghcr.io/rajasatyajit/charts/sievant',
    'go install github.com/rajasatyajit/sievant/cmd/sievant@latest',
    'https://github.com/rajasatyajit/tokvera',
    'Tokvera v0.2.0',
    'version 0.2.0-rc.1',
    'tokvera_0.2.0_linux_amd64.tar.gz',
    'Sievant 0.2.0 is out',
  ])('flags: %s', (text) => expect(forbidden(text)).not.toHaveLength(0));

  it.each([
    'Launching soon',
    'Book a call',
    'WCAG 2.2 AA',
    'satyajit.rajaraman@halotrcer.com',
    'The audit takes about two weeks',
    'launched by a downloaded script (curl … | sh)',
    "Halotrcer's ranking model is at version 0.1.0",
    'may change before scoring 1.0.0.',
  ])('allows: %s', (text) => expect(forbidden(text)).toHaveLength(0));
});

describe('claim scan', () => {
  it.each([
    'Cuts latency by 40%',
    'Saves $12,000 a month',
    '3x faster',
    'p99 of 250 ms',
    'Used by 200 teams',
    'Trusted by leading AI companies',
    '1,000 stars on GitHub',
  ])('flags: %s', (text) => expect(findViolations(text)).not.toHaveLength(0));

  it.each([
    'Find where your AI spend leaks.',
    'One check. No telemetry, no account.',
    'Graded A–F in a self-contained report.',
    'OWASP LLM Top 10 mapping',
  ])('allows: %s', (text) => expect(findViolations(text)).toHaveLength(0));
});

describe('security headers', () => {
  it('CSP has no unsafe sources and locks framing', () => {
    const csp = contentSecurityPolicy({ analytics: false });
    expect(csp).not.toMatch(/unsafe/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self';");
  });
  it('analytics adds only the Cloudflare beacon origins', () => {
    const csp = contentSecurityPolicy({ analytics: true });
    expect(csp).toContain("script-src 'self' https://static.cloudflareinsights.com;");
    expect(csp).toContain("connect-src 'self' https://cloudflareinsights.com;");
  });
  it('round-trips through the _headers parser', () => {
    const rules = parseHeaders(headersFile({ analytics: false }));
    const all = rules.get('/*');
    expect(all?.get('strict-transport-security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
    expect(all?.get('x-frame-options')).toBe('DENY');
    expect(rules.get('/_astro/*')?.get('cache-control')).toContain('immutable');
  });
});

describe('claim registry', () => {
  it('rejects entries without a complete source', () => {
    expect(() =>
      parseClaims('- id: a.b\n  text: x\n  source: { repo: tokvera, path: README.md }\n'),
    ).toThrow();
    expect(() => parseClaims('- id: a.b\n  text: x\n')).toThrow();
  });
  it('rejects duplicate ids', () => {
    const entry = '- id: a.b\n  text: x\n  source: { owner: true, decided: 2026-10-21, note: n }\n';
    expect(() => parseClaims(entry + entry)).toThrow(/Duplicate/);
  });
});

describe('passesPrelaunch', () => {
  it('holds back GitHub private vulnerability reporting until launch', () => {
    expect(passesPrelaunch('use GitHub’s private vulnerability reporting')).toBe(false);
    expect(passesPrelaunch('Use GitHub Private Vulnerability Reporting on this repo')).toBe(false);
  });

  it('lets an email-only reporting route through', () => {
    expect(passesPrelaunch('Report a vulnerability to security@example.com.')).toBe(true);
  });
});
