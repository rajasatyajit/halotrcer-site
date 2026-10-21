---
title: Security-posture report
source:
  repo: sievant
  path: docs/report.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: true
order: 8
---

`sievant report` writes a report a team can hand to a customer's security
reviewer: how Sievant sits between AI agents and their MCP servers, which
controls are in force, what those controls did in a period, where coverage
stops, and how that answers common security-questionnaire topics.

```sh
sievant report --period 30d --org "Example Co"
# wrote ./sievant-report-2026-10-19.html
# wrote ./sievant-report-2026-10-19.pdf
```

It describes the configuration and the audit trail. It is not a
certification, an audit or an attestation, and every format says so.

## What it reads

It only reads; nothing is changed and nothing leaves the machine.

| Source | Default | Flags |
|---|---|---|
| Configuration | `--config`, then `SIEVANT_CONFIG`, then the default path (as every command) | `--config <path>` |
| Audit store | the configuration's `audit.local.path`, else `<state dir>/audit.db` (where `sievant proxy` writes) | `--audit <path>` |
| MCP client configurations | discovered as `sievant scan` discovers them | `--client-config <path>` (repeatable), `--no-clients`, `--no-project` |

Without a configuration file, the report describes `sievant proxy` as
`sievant wrap` launches it (the local developer path), and reads which
wrapped servers pin their tool definitions from the client configurations.

A missing audit store is reported as a coverage gap, not an error: the
report then shows the configuration only, and its counts read "n/a".

Secret values, commands, arguments, URLs, headers and environment values
are never included. Server, agent, connector and tool names are. Paths
under your home directory are shown from `~`, and your user name is
replaced by `<user>` wherever it appears (a path outside home, an error
message, an agent or server name), in every format and in the terminal.

## Coverage comes first

Controls act only on traffic that passes through Sievant. The report
therefore leads, in every format and in the terminal, with how many of the
MCP servers in this machine's client configurations run through it: launched
through `sievant proxy` (`sievant wrap`) or `sievant serve`, or, for an HTTP
gateway configuration, pointed at a URL with the gateway's port and path.

- **None:** "No MCP traffic on this machine currently passes through
  Sievant". Every configured control on traffic shows **Configured, not in
  path**, and questionnaire topics answered by those controls show
  **configured, not in path**.
- **Some:** "Only N of M MCP servers ... run through Sievant". Enforced
  controls on traffic show **Partial**, with how many servers they cover.
- **All**, or client configurations not read: statuses as configured.

The "Controls enforced" count is of controls on traffic; the client scan
and client coverage are reported separately.

## Sections

1. **Architecture of the control**: the data path (agents, Sievant's checks
   in order, MCP servers, the audit store), the deployment, transport,
   TLS, agent identity, mode, connectors, and the MCP servers in the client
   configurations with whether each runs through Sievant. Servers that
   bypass Sievant are drawn as such.
2. **Controls in force**: each control with its status from the
   configuration (enforced, observe only, partial, off, not applicable),
   what is configured, and the OWASP Top 10 for LLM Applications
   categories it addresses (`sievant policy owasp`).
3. **Activity in the period**: requests, blocked (policy and input or
   output checks), limited (rate limits and budgets), would-block (mode
   observe), redactions in arguments and results, authentication failures,
   requests by upstream and agent, security events by kind, the
   most-blocked tools and requests per agent. The activity is everything
   in the audit store: wrapped client servers, `sievant proxy` sessions
   started by hand, and gateways configured with the same store. Each
   upstream (the connector that served the request; for `sievant proxy`,
   its `--name`) is marked as defined in the configuration, a wrapped
   client server, or neither, and requests from upstreams that are neither
   are listed as an info gap. Records written before Sievant recorded the
   connector (audit schema 4) show as "(no connector)", as do requests
   for names that do not exist.
4. **Coverage gaps**: each with a severity, why it matters and the fix.
5. **Security questionnaire topics**: access control, logging and
   monitoring, data protection, third-party components and AI agent
   safeguards, each answered by the status of its controls. The mapping is
   versioned data (`internal/defaults/questionnaire/questionnaire.yaml`);
   the questions are Sievant's own wording.
6. **Sources and method**, and the disclaimer.

The footer offers a professional review of the setup (a link to
https://www.halotrcer.com/book). `--no-cta` removes it from every format.

## Output

| Flag | Default | |
|---|---|---|
| `--period` | `30d` | `7d`, `36h`: 1s to 366d |
| `--out` | current directory | created if missing |
| `--format` | `html,pdf` | any of `html`, `pdf`, `json`, comma-separated |
| `--org` | | the organization named in the title |
| `--json` | | the report JSON on stdout instead of the terminal summary |

Files are named `sievant-report-<YYYY-MM-DD>.<format>`, written atomically
with mode 0600. A later report the same day gets `-2`, `-3`, ... before the
extension, so an earlier report (for example the default one, before a
`--no-cta` run) is never replaced.

- **HTML**: one self-contained page: inline CSS and SVG, no scripts, no
  external resources, light and dark themes, printable.
- **PDF**: A4, standard Helvetica fonts. Characters outside Windows-1252
  are shown as `?` in the PDF only (the HTML and JSON keep them).
- **JSON**: `report_version: 1`. Fields are only ever added within a
  version.

Exit codes: 0 written, 1 error (an unreadable or invalid configuration, an
audit store from a newer Sievant, a write failure), 2 usage. There is no
exit code for gaps.

## How the counts are made

Requests are the tool, prompt and resource requests in the audit trail.
Security events past the audit flood limit are stored as one summary per
key and window; the report counts each event once, and a summarized
request that was stopped counts as a blocked request. A summary whose
window began before the period counts in full. If the period holds more
than 2,000,000 records, the counts are marked as a lower bound.
