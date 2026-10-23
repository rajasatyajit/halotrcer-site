---
title: Commands
source:
  repo: sievant
  path: docs/commands.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: true
order: 14
---

Every `sievant` command, in one table.

## Commands

```sh
sievant serve --config config.yaml      # serve MCP over stdio
sievant validate --config config.yaml   # load and validate; exit 0 if valid
sievant hash-key < keyfile              # print the SHA-256 digest of an API key
sievant agent add cursor --switch-provider  # declare an agent and make its key (shown once)
sievant version
sievant version --json                  # version, commit, date, Go, OS/arch
sievant config show --sources           # effective configuration, each value with its source
sievant config path                     # which configuration file is used, and why
sievant config template                 # starter configuration (embedded)
sievant proxy -- npx -y @example/server # front another MCP server (stdio or --url)
sievant scan                            # audit the MCP client configurations on this machine
sievant wrap --all                      # route those servers through Sievant (backs up first)
sievant unwrap                          # restore the configurations byte for byte
sievant ui                              # local read-only view of audited calls (one-time link)
sievant init                            # new configuration: profile observe, balanced or strict
sievant policy suggest --since 7d        # least-privilege policies from the audit trail
sievant policy diff current.yaml new.yaml  # policy changes, and which recent requests they would decide differently
sievant policy apply new.yaml            # apply it: validated, diffed, loosenings confirmed, backed up
sievant policy packs                    # built-in policy packs and the OWASP LLM categories they address
sievant policy owasp                    # Sievant's controls mapped to the OWASP Top 10 for LLM Applications
sievant policy pins                     # tool definitions pinned on first use; accept changed ones
sievant doctor                          # check this installation; each problem with its fix
sievant doctor --webhook https://localhost:8443   # also the Kubernetes sidecar injector (after kubectl port-forward)
```

`--config` defaults to `$SIEVANT_CONFIG`, then the per-user
`config.yaml`; precedence is flags > `SIEVANT_*` environment > file >
defaults. See [docs/configuration.md](configuration.md) and
[docs/exit-codes.md](exit-codes.md). Sievant sends no telemetry.

All logs and diagnostics go to **stderr**; stdout carries only MCP messages
(`serve`) or the digest (`hash-key`).
