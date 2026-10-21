---
title: Troubleshooting
source:
  repo: sievant
  path: docs/troubleshooting.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: true
order: 16
---

Start with `sievant doctor`: it checks the configuration, the per-user
state, every wrapped server and the policy file it runs under, the
gateway's ports and certificate (and, with `--webhook <url>`, the
Kubernetes sidecar injector), and prints the fix for each problem. It is
read-only.

Each entry below starts with what you see. `sievant <command> --help`
documents every flag, and [exit-codes.md](exit-codes.md) the exit codes.

Wrapped servers log to standard error, which MCP clients keep in their
server logs (Claude Desktop: the `mcp-server-<name>.log` files in its
logs folder; Claude Code: `claude --debug`; Cursor and VS Code: the MCP
output panel). The lines are JSON with a `msg` field; the messages
quoted below are those.

## A client's server fails to start after `sievant wrap`

- **The binary moved or was removed.** Wrapped entries launch Sievant
  by its absolute path (the `command` of the entry). If you uninstalled
  Sievant or installed it somewhere else, the client cannot start it. Run
  `sievant unwrap` with any working copy of Sievant (it restores the
  originals from the backups), or wrap again from the new install.
- **`this sievant runs from a temporary directory (…), which clients
  cannot rely on`.** `wrap` refuses to write the path of a binary under
  a temporary directory (for example one built by `go run`). Install
  Sievant, or give `--sievant <absolute path>`.
- **The original command fails.** `sievant proxy` starts the server's own
  command; if that fails, so does the wrapped entry. Run `sievant unwrap`
  and check that the server starts on its own, then wrap again.
- **`no per-user state directory (set HOME, XDG_STATE_HOME or
  LOCALAPPDATA), so give --audit <path>`**, or **`no per-user state
  directory for the HMAC key, so set SIEVANT_HMAC_KEY`.** The client
  starts servers without `HOME` (or `LOCALAPPDATA` on Windows), so the
  proxy has nowhere to keep its audit store and key. Add `HOME` to the
  entry's `env`; or give the proxy `--audit <path>` and set
  `SIEVANT_HMAC_KEY` (32 bytes or more) in the entry's `env`.

## `sievant wrap` left a server as it was

`wrap` prints the reason for every entry it does not change:

- `already launched through Sievant`: wrapping again changes nothing.
  To change an entry's arguments (for example to add `--policy`), run
  `sievant unwrap`, then wrap again.
- `uses the HTTP+SSE transport (2024-11-05), which Sievant does not
  connect to`: Sievant connects to Streamable HTTP. Use the server's
  Streamable HTTP endpoint if it has one.
- `remote server with no credential configured: the client probably
  signs in with OAuth, which Sievant cannot do for it yet`: wrapping
  would break the sign-in, so the entry is left alone.

## `wrap rewrites client configuration files; give --yes to confirm when not on a terminal`

`wrap` asks before writing. In a script, run `sievant wrap --all
--dry-run` to see the diff, then `sievant wrap --all --yes`.

## `sievant unwrap` did not restore a file

`edited since wrap; not restored`: you or the client changed the file
after it was wrapped, and `unwrap` will not overwrite that edit silently.
`sievant unwrap --force` restores it anyway and keeps the current
content in the backup. `sievant unwrap --list` shows every wrap run, and
`--backup <id>` restores an older one.

## A tool disappeared from my client

`upstream tool withheld: its definition changed since it was pinned on
first use`. The server changed the tool's description or input schema
after you first used it, which is what a malicious update ("rug pull")
looks like. Check what changed, then accept it:

```sh
sievant policy pins                     # pinned tools, and changed ones waiting for review
sievant policy pins accept <server>     # serve the changed tools again
```

`<server>` is the `--name` in the wrapped entry. Wrap with `--no-pin` to
turn pinning off for new entries.

## A call is refused

The agent sees a short message; the reason is in `sievant ui` and the
server log:

- `Arguments contain a credential (…); call blocked.` A key or token was
  in the arguments. Pass credentials through the server's environment,
  not through tool arguments.
- `Argument 'url': value not permitted by policy` or the same for a path
  (the strict profile). `sievant ui` names the key to edit:
  `arguments.urls.hosts` or `arguments.paths.under` in the profile file.
  Strict allows paths under the directory `sievant init` ran in and no
  URL at all until you list hosts.
- `The tool's result looks like a prompt-injection attempt and was
  withheld.` The strict profile withholds results in the detector's
  high-confidence tier. `sievant ui` shows the score and signals. If the
  result was benign, set `injection.action: annotate` in the profile to
  mark such results instead of withholding them.
- A rate-limit error: the proxy allows 50 calls a second per server
  (bursts of 100) by default, or the profile's `rate_limit`.

## `sievant ui` says nothing has been audited

`Nothing has been audited there yet: wrap a server (sievant wrap) or run
sievant proxy, use it, then try again.` The audit store is created by
the first call through Sievant. Restart your client after wrapping, use
a tool, and try again. A gateway (`sievant serve`) writes where its
configuration's `audit.local.path` says: give that path with `--audit`.

## The `sievant ui` link does not work

The link signs one browser in once, then the token is spent: open it once,
in the browser you will use. If it was opened already, stop `sievant ui`
with Ctrl-C and start it again for a new link. The page listens on 127.0.0.1 only, so it must be opened on the
same machine.

## `sievant scan` finds no configurations

`scan` looks in each supported client's default location and in the
current directory's project files. A configuration somewhere else can be
scanned with `--config <path>` (repeatable; it scans the files given
instead of the discovered ones). [scan-and-wrap.md](scan-and-wrap.md) lists the locations.

## `sievant report` shows n/a for activity

The report found no audit store. Give `--audit <path>`, or for a
gateway, `--config <file>` so it reads that configuration's audit path.

## Getting help

Open an issue with the command, its output (`--json` if it has it),
`sievant version` and `sievant doctor`. Remove anything private first; Sievant masks secrets
in its own output, but your configuration paths and server names are
yours to share or not. Report security problems privately
([SECURITY.md](../SECURITY.md)).
