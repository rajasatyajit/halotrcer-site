---
title: Exit codes
source:
  repo: tokvera
  path: docs/exit-codes.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 14
---

Every `tokvera` command exits with one of four codes. The table below is the
contract. Scripts and CI gates may rely on it, and SPEC v0.2's
non-regression rule keeps it fixed: a code is never reassigned, and a new code
is added only by an explicit decision recorded in DECISIONS.md.

| Code | Meaning |
| --- | --- |
| `0` | The command did what it was asked. |
| `1` | Runtime error: an input could not be read, an output could not be written, a check the command performs failed, or (for `scan`) the plan was not confirmed. |
| `2` | Usage or configuration error: an unknown command or flag, a missing required flag, an invalid `audit.yaml`, an invalid global configuration (the config file or a `TOKVERA_*` variable, docs/config.md; every command but `help` and `version` checks it first). Nothing was run. |
| `4` | `scan --fail-under GRADE` only: the report was written and the grade is worse than `GRADE`. |

Code `3` ("not implemented") was retired in v0.1 (M8) when the last stub was
delivered. It is never returned, and it will not be reused.

## Per command

| Command | 0 | 1 | 2 | 4 |
| --- | --- | --- | --- | --- |
| `audit` | A bundle was produced. This includes runs where the LLM was unavailable or rejected (template narrative), the live bench was unauthorized or failed, remote embeddings were refused, or every record was excluded. | Unreadable telemetry, pricing or replay file; the bundle could not be written. | Invalid config (every error is printed at once). | — |
| `demo` | The sample bundle was written. | The built-in data could not be generated, or the bundle could not be written. | Bad flags (or a built-in demo configuration that fails validation, which is a build bug). | — |
| `scan` | `report.html` and `report.json` were written. This includes an interrupted run (the partial report has `run.cancelled: true`) and a `--dry-run`, which sends nothing. | Runtime error (an unreadable `--pricing` or `--prompts` file, no model discovered, a failed run, a report write); also when the plan was declined at the prompt (nothing was sent). | Usage error, including no terminal without `--yes` (nothing was sent), an endpoint listing several models without `--model`, and a `--max-cost` that cannot be enforced. | The grade is worse than `--fail-under` (a scan with no grade counts as worse). Opt-in: without the flag, `scan` never exits 4. |
| `scan summary` | The summary was written and, with `--baseline`, no figure regressed past its limit. | A latency or cost figure regressed past its limit against `--baseline` (a check the command performs failed), or a report could not be read or is not a v1 scan report. | Bad flags, a missing `--report`, a negative limit. | — |
| `list suites` | Listed. | — | Unknown list target. | — |
| `bench` | Results were written, or `bench.enabled` is false. | Not authorized (`bench.authorized`), a failed or interrupted run (partial results are still saved), a missing config file, the results could not be written. | A config that was read and rejected; bad flags. | — |
| `capture` | Stopped by SIGINT/SIGTERM after draining (bounded at 30 s). | `--out` is not writable, the listener could not bind, the proxy failed, or the log could not be closed. | Bad flags. | — |
| `findings validate` | Every file is valid. | A file is invalid (all errors are printed) or unreadable. | No file given; unknown subcommand. | — |
| `findings schema` / `types` | Printed. | `schema`: the embedded schema could not be generated (a build bug). | — | — |
| `playbooks validate` | The library is valid, every named artifact exists, and every finding type is covered. | Any of those checks failed. | Bad flags. | — |
| `sim generate` / `sim serve` | Generated / stopped cleanly. | Write or listen failure. | Bad flags or an unknown subcommand. | — |
| `instrument` | The files were written. | The directory exists and is not empty, or a write failed. | Bad flags, an unknown `--lang`, a `--name` out of bounds. | — |
| `audit report` | The page was written. | The bundle has no readable `report.md` or `run-manifest.json`, or the page could not be written. | A missing `--bundle` or `--client`, or a client name out of bounds. | — |
| `stack up` / `stack down` | The stack started / stopped. | Docker or its compose plugin is missing, a `--fixpack` lacks a file, compose failed, or (down) there is no stack. | Bad flags; no data directory. | — |
| `stack helm-values` | The two values files were written. | A `--fixpack` lacks a file, or a write failed. | Bad flags or namespace. | — |
| `cache` | Whatever `tokvera-cache` exits with. | `tokvera-cache` is not installed. | No arguments. | — |
| `init` | The config file was written. | It exists (without `--force`), input ran out, or the write failed. | Bad flags or values; no terminal without `--yes`. | — |
| `doctor` | No check failed. | A check failed (each prints its fix). | Bad flags. | — |
| `update` | Updated, already up to date, `--check` or `--dry-run`. | A download or verification failed (nothing was changed), or a package manager owns this install (its command is printed; nothing was changed). | Bad flags, a bad `--version`, an invalid `TOKVERA_INSTALL_*` mirror. | — |
| `uninstall` | Removed (or a dry run, or nothing to remove). | Declined at the prompt, the stack's files are still there, or a removal failed. | Bad flags; no terminal without `--yes`. | — |
| `report sign` / `report verify` | Signed / verified. | cosign is missing or failed, or (verify) the signature or a file does not match: NOT VERIFIED. | Bad flags, no `--key`/`--keyless` choice, a half-given identity. | — |
| `completion` / `man` | Printed. | — | No or an unknown shell; extra arguments. | — |
| `config show` / `config path` | Printed. | — | Bad flags or subcommand; an invalid global configuration (every error is printed). | — |
| `version`, `help` | Printed (even with an invalid global configuration, as is `doctor`, which reports it). | — | — | — |

Code `4` is the only code that depends on a judgement (the grade). It exists
so that a pipeline can gate on the grade without parsing the report. Its
thresholds are in [scoring.md](scoring.md), and they are provisional until
scoring 1.0.0.
