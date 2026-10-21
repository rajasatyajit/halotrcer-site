---
title: Global configuration
source:
  repo: tokvera
  path: docs/config.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 5
---

`tokvera` has one global configuration: defaults you set once for `scan` and
for the CLI's output. It is separate from `audit.yaml`, which keeps its v0.1
meaning (an audit is configured only by its own file).

## Where each value comes from

Each setting takes the first of these that has a value:

1. **A command-line flag:** `scan --suite deep`, or a global output flag
   before the command, `tokvera --quiet scan …`.
2. **Its environment variable:** `TOKVERA_` plus the key upper-cased, with dots
   as underscores (`scan.suite` is `TOKVERA_SCAN_SUITE`). An empty variable
   counts as unset.
3. **The config file.**
4. **The default.** Every default is the flag's own default, so with no file
   and no variables nothing changes.

`tokvera config show` prints every value with its source, and
`--format json` gives the same as JSON. `tokvera config path` prints the file
it reads and whether it exists.

## The file

YAML, nested by the key's dots:

```yaml
scan:
  suite: quick
  out: /var/tmp/tokvera-scans
  no_cta: true
output:
  quiet: true
```

- **Where it is:** the first of these that applies:
  - `$TOKVERA_CONFIG`, which must then exist;
  - `%APPDATA%\tokvera\config.yaml` on Windows;
  - `$XDG_CONFIG_HOME/tokvera/config.yaml` everywhere else, macOS included,
    when `XDG_CONFIG_HOME` is an absolute path;
  - `~/.config/tokvera/config.yaml`.
- **When there is no file:** the defaults apply.
- **When the file or a variable is invalid:** an unknown key, a value of the
  wrong kind, or YAML that does not parse stops every command but `help` and
  `version`, with exit 2. Every problem is listed at once, each with where its
  value came from.

## Settings

| Key | Environment | Flag | Kind | Default | Meaning |
|---|---|---|---|---|---|
| `output.json` | `TOKVERA_OUTPUT_JSON` | `--json` | bool | `false` | log records on stderr as JSON objects |
| `output.quiet` | `TOKVERA_OUTPUT_QUIET` | `--quiet` | bool | `false` | drop informational output; warnings, errors and results still print |
| `output.verbose` | `TOKVERA_OUTPUT_VERBOSE` | `--verbose` | bool | `false` | debug log records on stderr |
| `scan.api_key_env` | `TOKVERA_SCAN_API_KEY_ENV` | `scan --api-key-env` | string | `""` | environment variable holding the scan target's API key |
| `scan.no_cta` | `TOKVERA_SCAN_NO_CTA` | `scan --no-cta` | bool | `false` | leave the "Want this fixed?" footer out of scan reports |
| `scan.no_gpu` | `TOKVERA_SCAN_NO_GPU` | `scan --no-gpu` | bool | `false` | never run nvidia-smi during a scan |
| `scan.no_metrics` | `TOKVERA_SCAN_NO_METRICS` | `scan --no-metrics` | bool | `false` | never read the target's /metrics during a scan |
| `scan.out` | `TOKVERA_SCAN_OUT` | `scan --out` | string | `tokvera-scan` | where scan reports are written |
| `scan.pricing` | `TOKVERA_SCAN_PRICING` | `scan --pricing` | string | `""` | rate sheet for scan cost figures (empty: the embedded sheet) |
| `scan.request_timeout` | `TOKVERA_SCAN_REQUEST_TIMEOUT` | `scan --request-timeout` | duration | `60s` | per-request timeout during a scan |
| `scan.suite` | `TOKVERA_SCAN_SUITE` | `scan --suite` | string | `standard` | scan suite: quick, standard or deep |

**A scan target is never a setting.** Load goes only to a target named on the
command line, and with `--yes` only an explicit `--target` is used (SPEC
v0.2). The same holds for the model and the endpoint kind.

## Output flags

The output flags are global: they go before the command.

```sh
tokvera --quiet scan --target … --yes
tokvera --json audit --config audit.yaml
```

A flag after the command belongs to that command; `doctor --json`, for
example, is doctor's own JSON output.

- **`--quiet`:** drops informational output.
  - `scan` still prints the grade, the simulated-data notice and where the
    report is.
  - `audit` still prints where the bundle is.
  - The scan plan is dropped only when nothing asks about it (`--yes`,
    `--demo`); otherwise it is the text you are agreeing to, and it prints.
  - Warnings and errors always print.
- **`--verbose`:** adds debug log records on stderr (the configuration file
  and every value that did not come from its default).
- **`--json`:** writes log records as JSON objects, one per line on stderr.
  `scan` and `audit` end with a `scan result` / `audit result` record.
  Combined with `--verbose`, the debug records are JSON too.
- **Neither `--verbose` nor `--json`:** no log records at all, and the output
  is exactly what it was before these flags existed.
- **`--quiet` with `--verbose`:** a usage error (exit 2).

`NO_COLOR` is honoured by construction: tokvera writes no colour or other
terminal escape codes, and a test keeps it that way.
