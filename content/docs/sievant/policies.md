---
title: Policies
source:
  repo: sievant
  path: docs/policies.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: true
order: 2
---

What Sievant enforces and how to choose it without writing policy from
scratch. `sievant config show --sources` prints every effective value
and where it came from (the file, a pack, a default).

## Profiles

`sievant init` writes a new configuration from one of three profiles
(the default is observe). It writes `./sievant.yaml` in the current directory unless told otherwise:
`--output <path>`, or `--user` for the per-user configuration file that
every command given no `--config` loads. It prints the path it wrote and
whether later commands load it. An existing file is replaced only with
`--force`, after a diff and a confirmation (`--yes` off a terminal), and
is kept as `<file>.bak-<time>`.

| Profile | Blocks | Packs |
|---|---|---|
| observe | nothing: decisions that would stop a call are recorded as `WOULD_BLOCK` events (`sievant ui`) | `owasp-llm` |
| balanced | credentials in arguments, calls over the per-tool rate limits, changed tool definitions; personal data is redacted, suspected prompt injection annotated | `owasp-llm` |
| strict | balanced, plus path arguments outside the directory `init` ran in, every URL argument until you list hosts, and high-confidence prompt injection | `owasp-llm`, `fs-paths`, `egress` |

Observe mode is not a protection. Authentication, size caps and the SSRF
guard stay enforced in every mode; everything else is recorded and
allowed.

### Allowing a host or a path under strict

Strict starts with `arguments.urls.hosts: [none.invalid]`, a reserved
name that matches nothing, and `arguments.paths.under` set to the
directory `init` ran in: the current directory, wherever `--output`
puts the file. To allow more, edit those two keys in the file `init`
wrote. `init` prints the file and the keys, and every blocked
call's reason (in `sievant ui` and the server log) names the key to edit
and, for a URL, the host:

```
argument 'url': URL is not to an allowed host; to allow it, add "docs.example.org" to arguments.urls.hosts in the configuration (in place of none.invalid, which matches nothing)
```

The agent's own error message names only the argument, never the
permitted values.

### Applying a profile to wrapped servers

A profile configures a gateway run with `sievant serve --config <file>`.
The servers that `sievant wrap` routes through Sievant run `sievant
proxy`, which by default uses its own fixed policy: credentials in
arguments are blocked, secrets in results redacted, tool definitions
pinned and prompt injection scored, with no path or URL allowlists.
Entries `wrap` writes also mark suspected prompt injection
(`--annotate-injection`, the `annotate` action: a suspect result reaches
the agent inside untrusted-output markers) unless `--no-annotate`. To
put wrapped servers under a profile:

```sh
sievant init --profile strict --output ~/.config/sievant/strict.yaml
sievant wrap --all --policy ~/.config/sievant/strict.yaml
```

Strict limits path arguments to the directory `init` ran in, not the
directory of `--output`: run it from the directory your agent works in,
or edit `arguments.paths.under` afterwards.

Each newly wrapped entry then runs `sievant proxy --config <file>` (an
absolute path), which takes the file's policy layer: `mode`, `packs`,
`arguments`, `injection`, `rate_limit` (in place of proxy's `--rate`),
`sanitization` (its HMAC key excepted) and `pinning`. Its other sections
(`server`, `identity`, `policies`, `audit`, `connectors`) are not used:
the proxy still serves every tool of the server it fronts, records to
the per-user audit store and uses its own HMAC key, so the audit records
of all wrapped servers verify with one key. `wrap` checks the file loads
before writing anything.

Under the observe profile a wrapped server blocks nothing, not even the
credentials in arguments that proxy's defaults block: observe records
what balanced would block (`WOULD_BLOCK` in `sievant ui`) and allows
it. Use it to watch for a while, then move to balanced.

Edits to the file take effect when the client next starts the server.
Entries wrapped earlier keep their arguments: run `sievant unwrap`, then
wrap again with `--policy`, to change them. `sievant scan` shows
the policy file of each wrapped server, and `sievant report` counts the
wrapped servers under a policy file and under proxy's defaults.

## Packs

A pack is a configuration fragment a configuration names under
`packs:`. The configuration's own values always win over a pack's.
`sievant policy packs` lists them and `sievant policy packs show <pack>`
prints one.

| Pack | What it does |
|---|---|
| `secrets-pii` | every built-in credential and personal-data detector; credentials in tool arguments are blocked, personal data redacted |
| `injection` | prompt-injection detection with action annotate (see below) |
| `fs-paths` | path arguments of every tool must lie under `arguments.paths.under`, which you must list |
| `egress` | URL arguments of every tool must be https URLs to `arguments.urls.hosts`, which you must list |
| `rate-limits` | each agent calls any one tool at most 2 times a second (bursts of 10) |
| `description-pinning` | tool definitions are pinned on first use; a changed one is withheld until `sievant policy pins accept` |
| `owasp-llm` | the packs above that need no input; see [owasp-llm-mapping.md](owasp-llm-mapping.md) |

## Prompt-injection confidence tiers

The local detector is a set of lexical heuristics. It cannot tell text
that carries an attack from text that discusses one: documentation,
code and questions about prompt injection quote the same phrases. So
its verdicts come in two tiers:

- **high**: the evidence includes something ordinary text about prompt
  injection does not contain: hidden text (Unicode tag characters,
  bidirectional controls, runs of zero-width characters), encoded
  blocks that decode to instructions, a forged Sievant provenance
  delimiter, or telling the model to keep something from the user.
- **standard**: everything else the detector flags.

`injection.block_tier: high` (the strict profile) makes action block
refuse only high-tier verdicts at or above the block threshold (0.80);
every other verdict at or above the flag threshold (0.60) is annotated
(results) or recorded (arguments). The default, `block_tier: any`,
blocks every verdict at or above the block threshold, as before.

Measured on the committed corpora with the default thresholds:
`testdata/injection-corpus` (independent, built from public datasets,
not written by Sievant's authors) and `testdata/injection-own`
(Sievant's own). Hard negatives are benign texts about prompts, code or
security questions: the false positives that matter.

| Tier | Corpus | Outcome under strict | False positives (benign) | On hard negatives | Injections caught |
|---|---|---|---|---|---|
| high | independent | blocked | 0 of 1754 (0.0%) | 0 of 332 (0.0%) | 36 of 2907 (1.2%) |
| standard | independent | annotated or flagged | 79 of 1754 (4.5%) | 79 of 332 (23.8%) | 983 of 2907 (33.8%) |
| high | own | blocked | 0 of 73 (0.0%) | 0 of 40 (0.0%) | 8 of 45 (17.8%) |
| standard | own | annotated or flagged | 10 of 73 (13.7%) | 10 of 40 (25.0%) | 26 of 45 (57.8%) |

Read it this way: strict refused no benign sample in either corpus, and
it blocks few attacks. Zero of 1,827 benign samples bounds the high
tier's false-positive rate at about 0.16% (95% confidence), not at zero.
The independent corpus's injections are mostly direct jailbreak prompts
in plain words, which the high tier does not try to catch; planted
content that hides itself is what it is for. Everything else is
annotated, so the model sees the result marked as untrusted, with its
score.

**Detection is not the defence.** Strict's blocking catches few
plain-language jailbreaks: 1.2% of the independent corpus's injections,
which are mostly attacks written in ordinary words. Do not rely on the
detector to stop prompt injection, and do not treat it as a jailbreak
blocker. Sievant's defence against injected instructions rests mainly on
what an injected instruction can make the agent do: tool permissions
(`policies`), path and URL argument rules, rate limits, pinned tool
definitions, and the checks on tool output (redaction, size and row
budgets, provenance annotation). Detection adds a signal and a record on
top of those.

The figures are generated, with the full reports, by
`SIEVANT_INJECTION_REPORT=1 go test ./pkg/guardrail -run TestInjectionCorpora`
(`testdata/injection-*/REPORT.md`), and a test keeps this table, the
data `sievant policy packs` prints, and the detector in step.

## Suggesting a policy from traffic

`sievant policy suggest --since 7d` reads the audit store and prints a
least-privilege `policies:` section: each agent is allowed only what it
used successfully in the window, with argument constraints inferred
from sanitized inputs where the evidence is clear. Redacted values are
never suggested. `sievant policy diff <a> <b>` compares two policy files
and replays the window's requests under both.

## Applying a policy

```
sievant policy suggest --since 7d > suggested.yaml
sievant policy diff ~/.config/sievant/config.yaml suggested.yaml
sievant policy apply suggested.yaml
```

`sievant policy apply <file>` replaces the configuration's policy keys
(`policies`, `mode`, `packs`, `arguments`, `rate_limit`, `injection`,
`pinning`) with those in the file and changes nothing else: a file that
sets any other key is refused, and every line outside the replaced keys
is kept byte for byte (a replaced key's own leading comments are
replaced with the file's). Then:

1. **Validate.** The result must parse and validate, or nothing is
   written.
2. **Diff.** The change is shown as a unified diff.
3. **Loosenings.** Every way the new policy is looser than the current
   one is listed under a WARNING: a block removed (a deny entry, an
   injection action or a sanitization action weakened, `mode: observe`,
   detection or pinning turned off), access granted (a new agent policy
   or allow entry not covered by an existing one), a path, host or
   scheme widened, or a limit raised (rate limits, constraint bounds,
   injection thresholds). Both configurations are compared as they take
   effect, with packs merged, so dropping a pack counts too. A change it
   cannot rank, such as a different `matches` expression, counts as a
   loosening.
4. **Confirm.** A tighter or equal policy asks `[y/N]`. A looser one
   needs `--allow-loosen` or typing `loosen`; `--yes` alone refuses it.
   Off a terminal, `--yes` is required. `--dry-run` stops after step 3.
5. **Back up and write.** The current file is copied to
   `<file>.bak-<time>` (UTC, marked Z: `config.yaml.bak-20261018T192102Z`; a
   second write in the same second adds `-2`; same mode), then the new one is written
   atomically, through a symlink to its target, and only if the file
   still holds what apply read (an editor's save in between makes apply
   stop with nothing written). The file is read back; if it does not
   hold what was validated, the backup is put back.

A running `sievant serve` reloads `policies`, `mode`, `arguments` and
`injection.action` when the file changes; apply names the keys that need
a restart (`rate_limit`, `pinning`, `packs`, the other `injection`
settings).
