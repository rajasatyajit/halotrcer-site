---
title: Local quickstart
source:
  repo: sievant
  path: docs/local-quickstart.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: false
order: 0
---

Put Sievant in front of the MCP servers your AI clients launch on this
machine: Claude Desktop, Claude Code, Cursor, VS Code and Windsurf. It
takes four commands and is undone with one.

## 1. Install

```sh
curl -fsSL https://sievant.halotrcer.com/install.sh | sh     # Linux, macOS
irm https://sievant.halotrcer.com/install.ps1 | iex          # Windows (PowerShell)
```

Other channels (Homebrew, Scoop, winget, packages, Go) are in
[install.md](install.md). Check the install with `sievant version`.

## 2. Scan

```sh
sievant scan
```

`sievant scan` reads every MCP client configuration it finds, plus the
project files (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`) in the
current directory. It changes nothing and starts nothing. It reports
hard-coded credentials, servers given the whole filesystem or home
directory, unpinned or downloaded-at-start servers, remote servers
without a credential or over plain HTTP, and credentials hidden in URLs.
Every secret it quotes is masked.

```sh
sievant scan --html scan.html    # a self-contained report to keep or share
sievant scan --inspect-tools     # also start the servers and check their tool descriptions (asks first)
```

Fix what it finds before you wrap. A hard-coded token in particular
should move to the environment and be rotated, since it has been on disk.
[scan-and-wrap.md](scan-and-wrap.md) lists every rule.

## 3. Wrap

```sh
sievant wrap --all --dry-run   # see the change first
sievant wrap --all
```

Each server entry is rewritten to launch through `sievant proxy`, which
starts the original command and sits between it and the client. Before
anything is written, every file is backed up with a checksum, and the
rewritten file is checked: every other server must be unchanged and every
wrapped one must launch Sievant. Comments and formatting are kept.

Restart your MCP clients. They work as before.

### What protects a wrapped server

`sievant proxy` serves every tool of the server, with these checks on
each call:

- **Credentials in arguments** (keys, tokens, private keys) block the
  call before it reaches the server.
- **Secrets in results** are redacted, including the values the server
  received in its environment (its own API keys).
- **Tool definitions are pinned** the first time they are seen. A tool
  whose description or schema later changes is withheld until you accept
  it with `sievant policy pins accept <server>`.
- **Prompt injection** in results is scored. A suspect result reaches the
  agent inside `<untrusted-tool-output>` markers whose random id the text
  cannot forge, so the model can tell it is untrusted, and is recorded in
  the audit trail and shown in `sievant ui`. (`sievant wrap --no-annotate`
  leaves the markers out.)
- **Rate and size limits:** 50 calls a second per server (bursts of 100)
  and bounded results.
- **Every call is audited** in a local SQLite file, with arguments
  redacted.

### Stricter: a profile

`sievant init` writes a configuration from a profile: observe (record
what would be blocked, block nothing), balanced, or strict (path and URL
allowlists, and the high-confidence prompt-injection tier withheld). To
run the wrapped servers under one:

```sh
cd ~/projects/my-app      # strict allows paths under the directory init runs in
sievant init --profile strict --output ~/.config/sievant/strict.yaml
sievant wrap --all --policy ~/.config/sievant/strict.yaml
```

Strict limits path arguments to the directory `init` ran in, wherever
`--output` puts the file, and allows no URL at all until you list hosts:
edit `arguments.paths.under` and `arguments.urls.hosts` in the file. Each
refused call's reason in `sievant ui` names the key to edit. Servers
wrapped earlier keep running as they were: `sievant unwrap`, then wrap
again with `--policy`. Under observe, a wrapped server blocks nothing,
not even the credentials that the defaults above block.
[policies.md](policies.md) covers the profiles.

## 4. Watch

```sh
sievant ui
```

This prints a one-time link to a dashboard on 127.0.0.1. It lists the calls
your clients made through Sievant, the decisions, what was blocked and
what was redacted. It reads the audit trail and changes nothing.

## Undo

```sh
sievant unwrap
```

This restores every file from the newest wrap and checks that each one is
byte for byte what it was. A file you edited after wrapping is left alone
unless you add `--force`, which keeps your edit next to the backup first.
`sievant unwrap --list` shows earlier wraps. Restart your clients
afterwards.

## Next

- A report for a customer's security review: `sievant report`
  ([report.md](report.md)).
- A gateway for a team, with identity and per-agent policies:
  [gateway.md](gateway.md) and [policies.md](policies.md).
- Kubernetes: [kubernetes.md](kubernetes.md).
- Something not working: [troubleshooting.md](troubleshooting.md).
