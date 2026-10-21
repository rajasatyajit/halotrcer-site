---
title: Threat model
source:
  repo: sievant
  path: docs/threat-model.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: true
order: 11
---

This document grows with each milestone; M10 completes it. Each entry
names the threat, what Sievant does about it, and what the operator
configures.

## Denial of service: connection and TLS-handshake exhaustion

**Threat.** Every TCP connection costs Sievant goroutines and memory, and
every TLS connection costs a handshake (asymmetric cryptography, the
most expensive CPU step a client can make the server do) before a single
request is admitted, authenticated or rate-limited. A client, a
misbehaving agent fleet, or an ordinary HTTP client starting cold (it
dials one connection per waiting request until its first connection has
negotiated HTTP/2: 1,000 concurrent calls made 600 to 2,100 connections
in tests on 2 cores) can exhaust the server before request-level limits
(`max_inflight_calls`, rate limits) ever apply. HTTP/2 adds a second
axis: one connection can carry many concurrent streams.

**Mitigations.**

| Control | Where | What it bounds |
|---|---|---|
| `server.limits.max_clients` (required) | accept | open connections in total |
| `server.http.limits.max_conns_per_ip` | accept | open connections per client address (IPv6 grouped by `ipv6_prefix`), so one host cannot take every slot |
| `server.http.limits.max_streams_per_conn` (default: in-flight plus queued calls, at most 1,000) | HTTP/2 | concurrent requests on one connection |
| `server.http.read_header_timeout`, `read_timeout`, `idle_timeout` | connection | slow or idle clients holding slots |
| `max_inflight_calls`, `max_queued_calls`, rate limits | request | admitted work |

Connection limits are checked when the connection is accepted, before
the TLS handshake: a refused connection costs one accept and one close,
never a handshake. Requests on accepted connections never touch the
limiter (the 2 ms policy-evaluation budget is unaffected).

**Detection.** Refusals are counted in
`sievant_connections_refused_total{reason="max_clients"|"per_ip"}` and
summarized in at most one WARN per `refusal_log_interval` (default 10s),
naming the five busiest sources. The busiest sources are tracked with
the Space-Saving algorithm over 1,024 slots, so a heavy source stays
visible during a storm from many addresses, and the log cannot be
flooded by the storm itself.

**Recommended values** for HTTP deployments. `sievant init` writes stdio
configurations, where they do not apply and validation refuses a
`server.http` block; `init --profile strict` writes exactly these values
as a commented `http` block, to uncomment after switching to HTTP serve
(raising `server.limits.max_clients` to at least `max_conns_per_ip`
too):

```yaml
server:
  limits:
    max_clients: 500            # size to the expected clients plus headroom
  http:
    read_header_timeout: 5s
    limits:
      max_conns_per_ip: 16      # HTTP/2 needs 1; 16 absorbs a cold-start burst
      ipv6_prefix: 64           # one site or host usually holds a whole /64
      max_streams_per_conn: 32  # one connection cannot take every worker slot
      refusal_log_interval: 10s
```

**Operator notes.**

- Behind a TLS-terminating proxy (`tls.mode: upstream_terminated`), the
  proxies in `trusted_proxies` are exempt from `max_conns_per_ip`,
  because every client arrives through them. Limit per client at the
  proxy instead.
- Clients behind one NAT address share a per-address limit: raise
  `max_conns_per_ip` for such networks rather than removing it.
- A refused client sees the connection closed. Well-behaved clients
  reuse one HTTP/2 connection and never reach the per-address limit once
  warm.
- The dashboard listener has its own fixed connection cap and is not
  covered by `server.http.limits`.

**Residual risk.** A distributed attack from many addresses can still
fill `max_clients`; the limits keep the server responsive and the attack
visible, but blocking it belongs upstream (network filtering, a load
balancer or DDoS protection).

## Observe mode

**Threat.** `mode: observe` lets through what policy would stop:
denied tools, credentials in arguments, injection-laden results, calls
over rate limits and budgets. An installation left in observe mode is
monitored, not protected.

**What Sievant does.** Observe mode is never a default for an existing
configuration (absent `mode` is enforce); only `sievant init` writes it,
for new installs. Startup and any reload into observe mode log a warning,
and every would-be block is a `WOULD_BLOCK` audit event. Authentication,
size caps, the SSRF guard, memory budgets, connection limits and rug-pull
refusal stay enforced. Move to `balanced` or `strict` once `sievant ui`
shows what they would block.

## Tool description changes ("rug pulls")

**Threat.** An MCP server, or a new version of its package, changes a
tool's description or schema after the user approved it, to steer the
model (instructions in the description) or to widen what the tool does.

**What Sievant does.** Agents are served the definitions read at
startup; within a run a changed definition is refused. With pinning on
first use (`description-pinning`), the first definitions seen are
recorded on disk, and a change seen on any later start withholds the tool
until an operator accepts it. Configured pins (`tools[].sha256`) hold a
tool to an exact definition.

**Residual risk.** The first definition is trusted as seen (trust on
first use): review it (`sievant scan --inspect-tools` flags
instruction-like descriptions) or pin it in the configuration. A server
can change behaviour without changing its definition; pins cover what
the model is told, not what the server does.

## Path and URL arguments

**Threat.** An agent steered by injected text asks a filesystem tool for
`~/.ssh/id_rsa` or a fetch tool for an attacker's URL (exfiltration by
egress).

**What Sievant does.** `arguments.paths` and `arguments.urls` (packs
`fs-paths`, `egress`) and the `path_under` / `url_hosts` constraints
refuse path arguments outside listed roots and URL arguments to unlisted
hosts, after cleaning paths and parsing URLs.

**Residual risk.** Sievant checks the argument text; it does not resolve
symbolic links or know a server's working directory (relative paths are
refused by default for that reason). Data can still leave through
arguments not named as paths or URLs (a query string inside a free-text
argument): the rules narrow egress, they do not prove its absence.

## Credentials in command lines and URLs

**Threat.** Some MCP servers are configured with the credential in the
command line (a token argument) or in a URL that is itself the credential
(a "capability URL": a UUID or high-entropy path segment, or a token or
user ID in the query, as some providers issue). Command lines are visible
to other local users and processes (`ps`, `/proc/<pid>/cmdline`, Task
Manager), and URLs are copied into logs, shell history, screenshots and
support tickets.

**What Sievant does.**

- `sievant scan` flags credentials in URLs (SEC003 passwords, SEC004
  capability URLs, in `url` fields and in arguments) and hard-coded
  secrets in arguments (SEC001, SEC002).
- Everything Sievant prints masks URL credentials, keeping scheme, host
  and shape (`https://mcp.example.com/server/{masked:36}/mcp?user_id={masked:8}`):
  scan reports (terminal, JSON, HTML), wrap's diff and dry run, every log
  line (a logger hook masks every logged string and error that contains a
  URL), the child server's stderr, error messages and `config show`.
- The parts of a configured URL that are credentials are also redacted
  from what the server sends back, like env and header values.
- `sievant wrap` moves header values into the entry's `env`, never into
  arguments.

**Residual risk.** A wrapped stdio server keeps its original arguments:
they are passed on the `sievant proxy … -- <command> <args>` command line,
so a token or capability URL in them is visible in the process list
exactly as it was before wrapping (once for `sievant proxy`, once for the
server it starts). Wrapping does not make this worse, and does not fix
it. The planned fix is `sievant wrap --externalize-secrets`: credential
arguments and capability URLs move into the entry's `env` and reach the
server through it, so no command line carries them. Until then, rotate
any credential that has appeared in a command line on a shared machine.

## Per-agent keys on one machine

**Threat.** Several local agents (two editors, a CLI agent) share one
Sievant configuration; one of them, steered by injected text, calls
tools allowed only to another.

**What Sievant does.** With `identity.provider: api_key`
(`sievant agent add`), each agent presents its own key and is held to
its own policy. The configuration holds only SHA-256 digests; keys are
shown once and compared in constant time.

**Residual risk.** Over stdio a key is passed in the client's server
entry (`SIEVANT_API_KEY`), so it is as safe as that client configuration
file: any process that can read the file, or launch the server with its
environment, can claim that agent. Give each client its own key, so a
client configuration that is shared or exposed costs only that key, and
rotate it then with `sievant agent token <name> --replace` (a running
`sievant serve` needs a restart to drop the old key). Keys separate
agents that do not read each other's configuration; they do not
separate processes running as the same user with full access to the
home directory.

## Plain HTTP for the in-pod sidecar (tls.mode loopback)

**Threat.** In Kubernetes sidecar mode the agent reaches Sievant over
HTTP inside its pod. Without TLS or credentials, anything that can reach
the listener can call tools as the pod's agent.

**What Sievant does.** `server.http.tls.mode: loopback` is accepted only
when `listen_addr` is a loopback address (127.0.0.1, ::1 or localhost);
startup refuses a listener that did not bind to one, and every request
from a non-loopback peer is refused (403). Only processes in the pod's
network namespace can connect, and with it `identity.provider: static`
names the one agent the pod runs (it needs `identity.static.agent`).
Every other configuration validates as before: static identity over a
network listener is still refused, and loopback cannot be combined with
mTLS, certificates or trusted proxies.

**Residual risk.** Every container in the pod shares the network
namespace, so each of them is the pod's agent to Sievant: run only the
agent and the sidecar in a pod Sievant guards. A pod with
`hostNetwork: true` shares the node's loopback, so the sidecar would be
reachable from other host-network processes on the node; the injector
refuses to inject into such pods. An agent that ignores
`SIEVANT_MCP_URL` and calls MCP servers directly bypasses Sievant. A
NetworkPolicy cannot stop it from the agent's side: the sidecar and the
agent share the pod's network identity, so their traffic looks the same.
Make the MCP servers accept connections from Sievant only: in gateway
mode, a NetworkPolicy on the servers' ingress that admits only the gateway
pods; in sidecar mode, servers that authenticate their callers (the
sidecar's connector credentials), which the agent does not hold.

## The sidecar injector (sievant webhook)

**Threat.** A mutating admission webhook sits on the path of pod creation.
If it is down it can block workloads, if it is compromised it can change
pods, and its certificate and RBAC are themselves targets.

**What Sievant does.**
- *Scope.* Two webhooks, each narrowed by a CEL match condition, so only
  pods that are to be injected reach it: those of labelled namespaces
  (unless opted out) and annotated pods. The release's own namespace and
  the `kube-*` namespaces are excluded, so the injector can never block its
  own restart.
- *What it changes.* The injector only adds to a pod (a native sidecar,
  volumes, one environment variable, one annotation) and refuses
  host-network pods. Pods are parsed with exact keys, so its patch paths
  are the ones the API server applies; the parser is fuzzed.
- *Failure policy.* `Fail` only where the operator chose the strict
  profile or set it; `Ignore` otherwise. Two replicas and a
  PodDisruptionBudget by default.
- *RBAC (self-signed mode).* `get` and `update` on one Secret, `create` on
  Secrets in its own namespace, and `get` and `patch` on one webhook
  configuration, nothing cluster-wide beyond that. With cert-manager it
  has no API access and no service account token.
- *Certificates.* An ECDSA P-256 CA and serving certificate, renewed well
  before expiry. A CA rotation publishes both CAs before the serving
  certificate moves to the new one. Replicas coordinate through the
  Secret's resourceVersion.

**Residual risk.** Anyone who can update the webhook configuration or its
Secret can redirect or impersonate the injector: protect both like any
admission controller's (cluster-admin only). With `Ignore`, a pod created
while the injector is unreachable runs without the sidecar; use `Fail`
(the strict profile) where that is not acceptable. The injector's own
pods, and pods in excluded namespaces, are never injected.

## MCP tasks (M2.6)

**Threat.** A task outlives the request that made it: its ID is a handle
to upstream state and to a result not yet delivered. Another agent that
learns or guesses it could read the result or cancel the work, and a
late result could slip past the checks a direct call gets.

**What Sievant does.**

- **IDs.** Agents get Sievant's own task IDs, 128 random bits from
  crypto/rand. The upstream's ID, which may be sequential or guessable,
  stays in Sievant's table and never reaches an agent.
- **Binding.** A task belongs to the agent identity that created it.
  `tasks/get`, `tasks/result`, `tasks/update` and `tasks/cancel` from any
  other identity get the same "Task not found" as a guessed or expired
  ID, and `tasks/list` shows the caller's tasks only. Agents that share
  one identity (one `static` agent for every client of a `sievant proxy`)
  share their tasks; give agents separate identities to keep them apart.
- **Checks on results.** A result does not skip the guardrails because
  it arrives later:
  - delivering it (`tasks/result`, or `tasks/get` of a finished task in
    2026-07-28) runs the whole `tools/call` chain again for the task's
    tool and arguments;
  - RBAC is checked again, so a tool denied after the task was created
    delivers nothing;
  - the output checks, budgets and audit apply to each delivery, and a
    result is never cached unchecked.
- **Upstream claims.** What an upstream says about a task is checked
  before use: the ID matches, the status is known, the timestamps are RFC
  3339, the TTL is a non-negative number. Status messages are scrubbed
  and redacted like progress messages.
- **Exhaustion.** At most 100 live tasks per agent and 1,000 in total.
  Tasks are kept at most 24 hours. Polls spend from a per-agent rate-limit
  bucket.

**Residual risk.**
- an upstream that asks for input during a task never gets it (requests
  from upstreams are refused), so the task may wait until its TTL;
- task state lives in memory: a restart of Sievant forgets every task
  (agents get "Task not found"), and the upstream keeps the work until
  its own TTL.
