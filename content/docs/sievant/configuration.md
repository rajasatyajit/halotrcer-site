---
title: "Configuration: files, precedence, output"
source:
  repo: sievant
  path: docs/configuration.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: false
order: 4
---

## Which configuration file

`serve`, `validate` and `config show` use the first of:

1. `--config <path>`
2. `SIEVANT_CONFIG`
3. the per-user default, if the file exists:
   - Linux and macOS: `$XDG_CONFIG_HOME/sievant/config.yaml`, else
     `~/.config/sievant/config.yaml`
   - Windows: `%APPDATA%\sievant\config.yaml`

If none applies, the command prints its usage line and exits 2, exactly as
v0.1.0 did. `sievant config path` shows which file is used and why.
`sievant config template` prints a starter file that is embedded in the
binary.

## Precedence

**flags > `SIEVANT_*` environment > configuration file > policy packs
(in the order `packs:` lists them) > built-in defaults.**

| Setting | Flag | Environment | File key |
|---|---|---|---|
| configuration file | `--config` | `SIEVANT_CONFIG` | (n/a) |
| log level | `--log-level` | `SIEVANT_LOG_LEVEL` | `server.log.level` |
| log format | `--log-format` | `SIEVANT_LOG_FORMAT` | `server.log.format` |
| JSON output | `--json` | `SIEVANT_OUTPUT=json` | (n/a) |
| colour (human reports, from M2 `scan`) | `--color auto\|always\|never` | `SIEVANT_COLOR`, `NO_COLOR` | (n/a) |

Every other setting comes from the file or its default.
`sievant config show --sources` prints each effective value with its
source (`flag`, `env`, `file`, `pack:<name>`, `default`). Values written as `${VAR}` are
shown as written and never expanded, and literal values under
secret-looking keys (`hmac_key`, `dsn`, `password`, `token`, …) are
masked.

## Output

- Logs are structured (`log/slog`) and go to **stderr**, as JSON by default.
- stdout carries only data: MCP messages (`serve`), the digest (`hash-key`),
  `--json` documents, and `config` output.
- `--json` is available on `version`, `validate`, `hash-key`, `config show`
  and `config path`.
- Colour (used by later human-readable reports) follows
  [no-color.org](https://no-color.org): any non-empty `NO_COLOR` disables
  it, as does `TERM=dumb` or output that is not a terminal. `--color
  always` overrides this.

## Connection limits (HTTP)

`server.limits.max_clients` bounds open connections; the optional
`server.http.limits` block adds per-client limits, all checked when a
connection is accepted, before the TLS handshake:

| Key | Default | Meaning |
|---|---|---|
| `max_conns_per_ip` | 0 (none) | open connections per client address; peers in `tls.trusted_proxies` are exempt; at most `max_clients` |
| `ipv6_prefix` | 64 | prefix length that groups IPv6 clients |
| `max_streams_per_conn` | min(`max_inflight_calls` + `max_queued_calls`, 1000) | HTTP/2 concurrent streams per connection |
| `refusal_log_interval` | 10s | at most one summary WARN per interval |

A connection over a limit is closed at once. Every refusal, including
one over `max_clients` (which v0.1.0 logged only at DEBUG), is counted in
`sievant_connections_refused_total{reason="max_clients"|"per_ip"}` and
summarized in one WARN per `refusal_log_interval`: "connections refused
at the connection limits", with the count per reason and the five
busiest sources. This applies to existing HTTP deployments without any
configuration change; the per-refusal DEBUG line stays. See
[threat-model.md](threat-model.md) for the recommended values.

## Privacy

Sievant sends **no telemetry**. It contacts only the backends and
upstream servers you configure.
