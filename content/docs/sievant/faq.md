---
title: FAQ
source:
  repo: sievant
  path: docs/faq.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: true
order: 18
---

## Does Sievant send anything anywhere?

No. Sievant sends no telemetry and has no account or license check. It
contacts only the MCP servers and backends you configure. The audit trail
is a SQLite file on your machine, and nothing leaves it unless you
configure an export (OTLP, syslog or a webhook; [telemetry.md](telemetry.md)).

## What does the audit trail keep?

For each call: the agent, the tool, the decision, sizes and timing, and
the arguments with secrets and personal data redacted, plus a keyed hash
of the raw arguments. It never keeps raw arguments, and it never keeps
results. On a developer machine it is `audit.db` in the state directory:
`~/.local/state/sievant` (or `$XDG_STATE_HOME/sievant`) on Linux and
macOS, `%LOCALAPPDATA%\sievant` on Windows. [audit.md](audit.md) has the
details.

## Will it slow my agent down?

Not noticeably. Sievant adds about 0.25 ms per tool call at the 99th
percentile on a laptop (BASELINE.md has the measurements). The release
gate is 2 ms, checked on every change. MCP servers usually take far longer
than that to answer.

## What exactly does `sievant wrap` change?

Only the server entries it wraps. Each one is rewritten to launch
`sievant proxy`, which starts the original command and sits between it and
the client. Comments, formatting and every other server stay byte for
byte. Every file is backed up first, and `sievant unwrap` restores it and
checks that it is byte for byte the original.
[scan-and-wrap.md](scan-and-wrap.md) shows the rewritten entries.

## Will my MCP servers still work after wrapping?

Yes. A wrapped server serves the same tools; Sievant blocks only calls
that carry a credential in their arguments, and withholds a tool whose
definition changed after you first used it until you accept the change.
Some entries are left as they are, with the reason printed: remote
servers that sign in with OAuth (Sievant cannot do that for them yet),
servers on the older HTTP+SSE transport, and entries already wrapped.

## Does wrapping protect anything without further setup?

Yes. A wrapped server gets, by default: credentials in arguments
blocked, secrets in results redacted (including the server's own keys
from its environment), tool definitions pinned on first use, suspected
prompt injection marked as untrusted for the model, rate limits, and an
audit record of every call. A profile adds path and URL allowlists and
blocking ([local-quickstart.md](local-quickstart.md#stricter-a-profile)).

## What is the difference between the profiles?

`sievant init --profile` writes one of three:

- **observe** records what balanced would block (`WOULD_BLOCK` events in
  `sievant ui`) and blocks nothing. Under observe a wrapped server blocks
  nothing at all, so use it for a short look, not as protection.
- **balanced** blocks high-confidence risks: credentials in arguments,
  calls over the rate limits, changed tool definitions.
- **strict** adds path and URL argument allowlists and withholds
  high-confidence prompt injection.

They apply to a gateway (`sievant serve --config`) or to wrapped servers
(`sievant wrap --all --policy <file>`). [policies.md](policies.md) has the
details.

## How reliable is the prompt-injection detection?

It is a heuristic, and Sievant says how it performs instead of claiming
it catches injection. `sievant policy packs` prints the measured rates on
the committed corpora. The high-confidence tier, the only one strict
blocks, had no false positives on 1,754 independent benign samples, and
catches a small share of injections. The standard tier catches more but
also flags ordinary text about prompts, which is why it marks results
rather than blocking them. Treat detection as one layer among
allowlists, least privilege and review of what your agents can do.

## Does Sievant see my API keys?

The values in a wrapped server's `env` reach the server as before.
Sievant treats them as secrets: if the server ever sends one back, it is
redacted before the agent sees it. Remote servers' header credentials are
moved out of the command line into the entry's environment, and Sievant
scrubs these values from its own logs and error messages.

## Which clients does it support?

`sievant scan` and `sievant wrap` know the configuration files of Claude
Desktop, Claude Code, Cursor, VS Code and Windsurf, plus project files
(`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`) in the current
directory. Any other file in a supported format can be given with
`--config <path>`. Any MCP client can talk to `sievant proxy` or a
Sievant gateway directly.

## How do I upgrade?

Upgrade the binary through the channel you installed it with. Wrapped
entries launch Sievant by its path, so they pick up the new binary on the
client's next start. New defaults for wrapped entries (such as marking
suspected prompt injection) apply to entries wrapped from then on:
`sievant unwrap`, then `sievant wrap --all`, to take them.

## How do I remove Sievant?

Run `sievant unwrap` first, so your clients launch their servers directly
again, then uninstall the binary. Uninstalling first leaves wrapped
entries pointing at a missing binary. The state directory (audit trail,
backups, pins) can then be deleted.

## Does it run on Kubernetes?

Yes: a Helm chart with a gateway mode and a sidecar mode, where a
mutating admission webhook injects Sievant into labelled namespaces.
See [kubernetes.md](kubernetes.md).

## Is it free? Is there a commercial edition?

Sievant is open source under the Apache License 2.0, with no closed code
in this repository. The single sign-on interface (OIDC identity for
agents) is reserved for a possible commercial edition; nothing in the
open-source edition depends on one.

## How do I report a vulnerability?

Privately, as [SECURITY.md](../SECURITY.md) explains. Please do not open
a public issue.
