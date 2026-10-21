---
title: Scan, wrap and the local UI
source:
  repo: sievant
  path: docs/scan-and-wrap.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: true
order: 1
---

The local developer path: audit MCP client configurations, route their servers through Sievant, and watch the calls. docs/local-quickstart.md walks through it.

## Scanning MCP client configurations

`sievant scan` reads the MCP server configuration of Claude Desktop,
Claude Code (user `~/.claude.json`, including per-project entries, and
the project `.mcp.json`), Cursor, VS Code (`mcp.json`, `settings.json`,
JSONC) and Windsurf, for the current OS, plus the project files in the
current directory (`--no-project` skips them), or only the files given
with `--config`. It never changes them.

| Rule | Severity | Finds |
|---|---|---|
| SEC001 | critical | a credential in a recognizable format (GitHub, GitLab, Slack, Anthropic, OpenAI, Stripe, AWS, Google, Hugging Face, npm, Notion, Linear, private keys, JWTs, database URLs with a password) in env, args or headers |
| SEC002 | high | a literal value in a secret-named variable, header or flag |
| SEC003 | critical | a password in a server URL |
| SEC004 | high | a credential embedded in a URL's path or query (a "capability URL": UUID or high-entropy path segments, token-bearing query keys such as `key`, `token`, `api_key`, `user_id`, or a path on a known capability-URL provider), in `url` or in args |
| PERM001 / PERM002 | high / medium | the filesystem root / the whole home directory given to a server |
| PERM003 | medium | all permissions (Deno), host network, privileged container |
| SUP001 | medium | an unpinned package or image, or a moving tag (`@latest`) |
| SUP002 | high | a server fetched from a git repository or URL, or launched by a downloaded script (`curl … \| sh`) |
| AUTH001 | medium | a remote server with no credential configured (it may still use OAuth) |
| NET001 | high | a remote server over plain HTTP |
| INJ001 | high/medium | with `--inspect-tools`: a tool description that reads like instructions to the model |
| MCP001 | info | with `--inspect-tools`: resources and prompts Sievant would withhold |
| MCP002 | info | with `--inspect-tools`: tools that need MCP tasks, on a server that does not declare tasks (docs/compatibility.md) |
| SVT001 / SVT002 | info | already launched through Sievant / could not be inspected |

Values that reference the environment or a prompt (`${VAR}`,
`${env:VAR}`, `${input:id}`, `$VAR`, `%VAR%`) are not hard-coded. Every
output masks secrets (`ghp_… (40 chars)`), including evidence that quotes
a command.

```sh
sievant scan                         # terminal summary
sievant scan --json > scan.json      # JSON report (report_version 1)
sievant scan --html scan.html        # self-contained, offline HTML (no scripts)
sievant scan --fail-on high          # exit 3 when a finding is high or worse
sievant scan --inspect-tools         # starts the servers to read their tools; asks first (--yes in CI)
```

`--inspect-tools` starts each server the way `sievant proxy` would (the
same connector, environment allowlist and limits) and runs the
prompt-injection detector over every tool's name, title and
description. Starting a server runs its code, so it is never the
default.

## Wrapping MCP clients

`sievant wrap` rewrites client configurations so their servers launch
through `sievant proxy`; `sievant unwrap` restores them.

```sh
sievant wrap --all --dry-run       # show the diff, write nothing
sievant wrap --all                 # asks before writing (--yes when not on a terminal)
sievant wrap github cursor:linear  # chosen servers (client:name when names repeat)
sievant unwrap                     # newest wrap run; --list, --backup <id>, --force
```

- **Only the wrapped entries change.** Comments, formatting, key order,
  line endings (LF or CRLF), a byte order mark and every other server stay
  byte for byte. Comments inside a wrapped entry are not carried over
  (unwrap restores them with the rest of the file).
- A stdio entry becomes `sievant proxy --name <server> --inherit-env
  <each env key> -- <original command and args>`; its `env` is kept, and
  those values are treated as secrets (redacted from what the server sends
  back) unless named with `--public-env NAME` (for values such as
  `NODE_OPTIONS` that are not secrets). A remote entry becomes `sievant proxy --url <url> --header-env
  <Header>=SIEVANT_HEADER_…` with the header values moved into `env`, so
  no credential is in the command line; private address ranges are
  allowed for it (cloud metadata addresses are not).
- **Tool definitions are pinned.** Each newly wrapped entry also runs
  `sievant proxy --pin-first-use`: the first definitions seen of the
  server's tools are recorded, and a tool whose description or schema
  later changes (a rug pull) is withheld until
  `sievant policy pins accept <server>`. `--no-pin` leaves it out.
  Entries wrapped before this default keep their arguments.
- **Suspected prompt injection is marked.** Each newly wrapped entry
  also runs `sievant proxy --annotate-injection` (injection action
  `annotate`): a result the detector suspects (a forged delimiter,
  instruction-like text) reaches the agent inside
  `<untrusted-tool-output id="…">` markers whose random id the text
  cannot close, with its score in `_meta`; other results are unchanged.
  `--no-annotate` leaves it out, and with `--policy` the file's
  `injection` decides. Entries wrapped before this default keep their
  arguments.
- **A profile, with `--policy <file>`.** Each newly wrapped entry runs
  `sievant proxy --config <absolute path>` and takes the file's policy
  layer (a profile written by `sievant init`; see
  [policies.md](policies.md#applying-a-profile-to-wrapped-servers)).
  Without it, entries run under the proxy's defaults. `sievant scan`
  shows `, policy <file>` on each wrapped server that has one.
- **Left as they are, with the reason printed:** entries already launched
  through Sievant (wrapping again changes nothing), HTTP+SSE servers
  (Sievant connects to Streamable HTTP), and remote servers with no
  credential configured (the client probably signs in with OAuth, which
  Sievant cannot do for it yet).
- **Safety.** Before writing, the rewritten file is parsed again: every
  untouched server must be identical and every wrapped one must launch
  Sievant, or nothing is written. Each original is backed up to
  `<state dir>/backups/<id>/` (0700; files 0600) with a SHA-256 manifest;
  each file is written atomically (temporary file, fsync, rename) with its
  original mode, through symlinks (a dotfiles link stays a link). A file
  that changed after it was read is never overwritten, and if any file of
  a run cannot be written, the files already written are restored. One
  wrap or unwrap runs at a time.
- **Unwrap** restores the backed-up bytes and reads each file back: it
  must match the original's SHA-256. A file edited since the wrap is left
  alone unless `--force`, which keeps the edited content next to the
  backup first.
- **Which binary the entries launch.** Clients start it long after wrap
  exits, so the path must last: `--sievant <path>` if given; otherwise
  the `sievant` on `PATH` when it is the running binary, kept as found
  (a package manager's symlink, such as Homebrew's, survives upgrades;
  the versioned path behind it would not); otherwise the running binary,
  with a note. A binary in a temporary or `go-build` directory (`go run`)
  is refused.
- Wrapped servers serve their tools only; wrap says so, and
  `--inspect-tools` lists the resources and prompts withheld per server.
  Restart the client after wrapping or unwrapping.

## Local UI

`sievant ui` shows the audit trail of servers launched through Sievant
(`sievant proxy`, `sievant wrap`): calls, policy decisions, blocked
actions and redactions, with counts for the last 24 hours. It reads the
audit store `sievant proxy` writes (`<state dir>/audit.db`, or
`--audit <path>`) read-only.

- Listens on `127.0.0.1` only, on a random port (`--addr` accepts
  loopback addresses only).
- The printed link carries a one-time token: the first visit trades it
  for a session cookie (HttpOnly, SameSite=Strict, 12 hours) and the link
  stops working, so a copied or logged link is useless.
- Every request must name the listener in its Host header (DNS
  rebinding is refused); the API is GET-only; the page loads only its
  embedded assets under `Content-Security-Policy: default-src 'none';
  script-src 'self'; …` and renders record fields as text, never as
  markup. No CDN, no telemetry.
- Inputs are shown sanitized, as audited; URLs in them are masked.
