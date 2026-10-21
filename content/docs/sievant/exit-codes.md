---
title: Exit codes
source:
  repo: sievant
  path: docs/exit-codes.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: false
order: 15
---

Every `sievant` command exits with one of these codes. Codes 0–2 have
meant the same thing since v0.1.0 and never change. New codes are only
ever added (`internal/exitcode`).

| Code | Meaning | Examples |
|---|---|---|
| 0 | Success | `validate` on a valid file; `serve` after a clean shutdown; `version`; `help` |
| 1 | The command ran and failed | invalid configuration; unreadable file; the server could not start; `config path` found no file; `report` could not write its files |
| 2 | Usage error | unknown command or flag; missing `--config` with no `SIEVANT_CONFIG` or default file; an invalid `--log-level` or `--color` value |
| 3 | Findings at or above a threshold | reserved for `scan --fail-on` and `--fail-under` (M2, M9A) |

With `--json`, the exit code is the same as without it. The JSON document
on stdout carries the details (for example `validate --json` lists
`problems`).
