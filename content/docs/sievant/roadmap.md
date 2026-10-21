---
title: Roadmap
source:
  repo: sievant
  path: docs/roadmap.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: true
order: 18
---

What is planned after the first release. There are no dates: items ship
when they are done and tested, and the order may change. Each lands
without breaking existing configurations, commands or output, as every
change so far has (CHANGELOG.md).

## First-run tools

- **`sievant update`:** a verified self-update (signature and checksum
  checked before the binary is replaced) that defers to the package
  manager when Sievant was installed through one.
- **`sievant uninstall`:** unwraps every wrapped client first, then
  removes Sievant.
- **Shell completions and a man page.**

## A GitHub Action

`sievant-scan-action` runs `sievant scan` on pull requests that change
MCP client configurations, comments a summary on the pull request, and
fails on findings at or above a severity you choose.

## Scoring, a demo, and compliance mapping

- **`sievant scan --demo`:** a scan of built-in, deliberately risky
  example configurations (a hard-coded token, filesystem root access, an
  unpinned remote server, an injection-laden tool description, an
  unauthenticated remote server), with no keys and no network, in under
  two seconds.
- **An exposure score:** an A to F grade from weighted pillars (secrets,
  permissions, supply chain, prompt-injection exposure, auditability),
  with the weights published and versioned. It is added beside the
  existing findings, and failing on a grade is opt-in. Checks that cannot
  be evaluated are reported apart, with what would enable them, and do
  not count towards the grade.
- **Scan suites:** quick, standard and deep, and themes (secrets,
  permissions, supply chain, injection).
- **Compliance mapping in `sievant report`:** each control and finding
  mapped to the OWASP Top 10 for LLM Applications, the NIST AI RMF
  functions, ISO/IEC 42001 control themes and EU AI Act topics, from a
  versioned data file with its sources. It maps controls to topics; it is
  not a certification.
- **Incident reconstructions:** scenarios rebuilt from publicly reported
  MCP and agent security incidents, each with its source, and a test
  showing the strict profile blocks or flags each one.
- **Signed results:** `sievant report sign` and `sievant report verify`.

## Agents operating Sievant

- **`sievant mcp`:** scan, the report summary and policy suggestions as
  MCP tools, so an agent can run them.
- **Plugins for Claude Code and Codex**, and `sievant install-skill`,
  which writes a slash command or rules file per agent.
- **A local, read-only API** (127.0.0.1 only, token required, off by
  default) serving the tool inventory, authorization decisions and the
  audit trail, with an adapter for iFixAi's agent grading.

## MCP connector controls

- **Personal-data rules per MCP server:** block or redact personal data in
  the arguments of every tool of a server, with per-tool overrides.
- **Binary content, opt-in:** pass images and other binary content of
  named servers (for example screenshot tools) under a size cap, each
  passed block recorded in the audit trail. Today only text passes and
  other content is replaced by a note.

## Development

- **Faster CI:** split the single CI job into parallel jobs (lint and
  vet, race tests, vulnerability checks, the Helm chart), so none comes
  near its time limit.

## Suggest something

Open an issue describing the problem you want solved. Security issues go
through [SECURITY.md](../SECURITY.md) instead.
