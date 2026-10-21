// Self-hosted runner rules (as Tokvera's TestSelfHostedRunnerRules): every job
// that can run on LINUX_RUNNER uses exactly the private-only expression, and
// right after checkout checks the host tools docs/development.md lists for it.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

export const LINUX_RUNNER =
  "${{ github.event.repository.private && vars.LINUX_RUNNER || 'ubuntu-24.04' }}";
const TOOLS = /^sh scripts\/ci\/runner-tools\.sh (.+)$/;

interface Step {
  uses?: string;
  if?: string;
  run?: string;
}
interface Workflow {
  jobs: Record<string, { 'runs-on'?: unknown; steps?: Step[] }>;
}

const doc = readFileSync('docs/development.md', 'utf8');
const workflows = readdirSync('.github/workflows').filter((f) => /\.ya?ml$/.test(f));

describe('self-hosted runner rules', () => {
  for (const file of workflows) {
    const wf = parse(readFileSync(join('.github/workflows', file), 'utf8')) as Workflow;
    for (const [name, job] of Object.entries(wf.jobs)) {
      const on = String(job['runs-on'] ?? '');
      it(`${file} ${name}: runs on LINUX_RUNNER only while private`, () => {
        // Every job here is Linux; none may name a self-hosted label directly.
        expect(on).toBe(LINUX_RUNNER);
      });
      it(`${file} ${name}: checks its host tools first on a self-hosted runner`, () => {
        const steps = job.steps ?? [];
        const checkout = steps.findIndex((s) => s.uses?.startsWith('actions/checkout@'));
        expect(checkout).toBe(0);
        const check = steps[checkout + 1];
        expect(check?.if).toBe("runner.environment == 'self-hosted'");
        const m = TOOLS.exec((check?.run ?? '').trim());
        expect(m, 'the step after checkout runs scripts/ci/runner-tools.sh').not.toBeNull();
        expect(doc, `docs/development.md lists "${m?.[1]}"`).toContain('```\n' + m?.[1] + '\n```');
      });
    }
  }
});

describe('runner-tools.sh', () => {
  const run = (...args: string[]) => {
    try {
      return {
        code: 0,
        out: execFileSync('sh', ['scripts/ci/runner-tools.sh', ...args], {
          encoding: 'utf8',
          stdio: 'pipe',
        }),
      };
    } catch (e) {
      const err = e as { status: number; stderr: string };
      return { code: err.status, out: err.stderr };
    }
  };
  it('passes when every tool is present', () => {
    expect(run('sh', 'git').code).toBe(0);
  });
  it('fails naming every missing tool', () => {
    const r = run('sh', 'no-such-tool-a', 'no-such-tool-b');
    expect(r.code).toBe(1);
    expect(r.out).toContain('lacks: no-such-tool-a no-such-tool-b');
  });
  it('is a usage error without arguments', () => {
    expect(run().code).toBe(2);
  });
});
