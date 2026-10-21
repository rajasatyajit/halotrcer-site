---
title: tokvera for coding agents
source:
  repo: tokvera
  path: docs/agents.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 6
---

tokvera reaches coding agents in three ways:
- **An MCP server:** `tokvera mcp`.
- **A plugin:** for Claude Code and for Codex.
- **A skill:** `tokvera install-skill` installs it on its own.

All three send load only to an endpoint the user named, and only after the
user agreed to it.

## `tokvera mcp`

A Model Context Protocol server on stdio. Add it to an agent:

```sh
claude mcp add tokvera -- tokvera mcp            # Claude Code
codex mcp add tokvera -- tokvera mcp             # Codex
```

| Tool | What it does | Touches |
|---|---|---|
| `scan_demo` | a full graded report from the built-in simulator | nothing (loopback) |
| `scan_plan` | what a scan would send: suite, caps, worst-case cost | nothing |
| `scan` | measure the endpoint and grade it; needs `confirm: true` | the target, with load |
| `summarize_report` | a report.json's grade and findings; with `baseline`, whether it regressed | nothing |
| `verify_report` | a signed report's signature and files (docs/report-signing.md) | nothing |
| `list_suites` | the load shapes | nothing |
| `doctor` | the installation and the tools tokvera uses | nothing |

- **`scan` refuses without `confirm: true`.** Its description tells the agent
  to show `scan_plan` to the user first. It is the only tool marked as
  touching the outside world (`openWorldHint`) and the only one not
  read-only.
- **Defaults here:** `scan` uses the `quick` suite unless told otherwise, and
  writes report.html and report.json to `out`, or to a new temporary
  directory whose path it returns.
- **Cancellation:** a call the client cancels stops the scan's load.
- **Protocol versions:**
  - the stateless 2026-07-28 revision (per-request `_meta`,
    `server/discover`);
  - through `initialize`, 2025-11-25, 2025-06-18, 2025-03-26 and 2024-11-05.
- **Output:** stdout carries only protocol messages, and logs go to stderr.

## The plugin (Claude Code and Codex)

One plugin, `agents/tokvera`, carries both tools' manifests. It brings the
`tokvera mcp` server and the `tokvera` skill. tokvera itself must be on PATH.

```sh
# Claude Code (2.1.275 or later)
/plugin install tokvera --marketplace rajasatyajit/tokvera
# or, from a shell:
claude plugin marketplace add rajasatyajit/tokvera
claude plugin install tokvera@tokvera

# Codex
codex plugin marketplace add rajasatyajit/tokvera
codex plugin add tokvera@tokvera
```

| File | For |
|---|---|
| `.claude-plugin/plugin.json`, `.mcp.json` | Claude Code |
| `plugin.json`, `mcp.json` (the portable agent-plugins format, `type: stdio`) | Codex |
| `skills/tokvera/SKILL.md` | both (the open Agent Skills format) |
| `/.claude-plugin/marketplace.json`, `/.agents/plugins/marketplace.json` | each tool's marketplace, at the repository root |

**When tokvera is not installed,** the skill tells the agent to ask the user
first. Then it runs the official installer, which downloads from GitHub, and
verifies the SHA-256 and, when cosign is installed, the release's signature.

**Versioning:** the plugin's version is the release's. The release preflight
refuses a tag the manifests disagree with.

The marketplaces work once the repository is public.

## `tokvera install-skill`

The skill without the plugin:

```sh
tokvera install-skill --agents all --dry-run      # the plan and its cost, nothing written
tokvera install-skill --agents claude,codex       # asks, then writes
```

- **Where the skill goes:**
  - Claude Code: `~/.claude/skills/tokvera/SKILL.md`;
  - Codex: `~/.agents/skills/tokvera/SKILL.md`;
  - with `--scope project`, under `.claude/` and `.agents/` in the current
    directory instead.
- **The plan comes first, with its cost.**
  - The skill's name and description join each agent's skill list at every
    start: about 350 characters, roughly 90 tokens.
  - The whole skill, about 3.3 KB, loads only when the agent uses it.
  - Tokens are estimated at about four characters each.
- **Then it asks:** a "y" at the terminal, or `--yes`.
- **An existing SKILL.md** that differs from tokvera's is kept unless
  `--force`.
