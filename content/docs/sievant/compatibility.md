---
title: Protocol compatibility
source:
  repo: sievant
  path: docs/compatibility.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: false
order: 12
---

Sievant speaks MCP to agents (as a server) and to upstream MCP servers
(as a client, `connectors.mcp` and `sievant proxy`).

## As a server (to agents)

| Revision | How the client connects | Offered by default | Differences from what Sievant sends 2025-11-25 clients |
|---|---|---|---|
| 2026-07-28 | stateless: every request carries its version in `_meta` | yes | `resultType`, `serverInfo` in `_meta`, cache hints (`ttlMs`, `cacheScope`), `server/discover`; resource not found is -32602 |
| 2025-11-25 | `initialize` handshake (`legacy_mode`, on by default) | yes | (reference) |
| 2025-06-18 | `initialize` | only when listed in `server.legacy_versions` | none |
| 2025-03-26 | `initialize` | only when listed | no `title` fields (tools, resources, resource templates, prompts, prompt arguments); no `structuredContent` (the structured result is sent as JSON text, appended unless a text block already holds the same value); over HTTP, `MCP-Protocol-Version` may be omitted |
| 2024-11-05 | `initialize` | only when listed | as 2025-03-26 |

**Negotiation.** A client that asks for a revision listed in
`server.legacy_versions` gets it; any other request gets the newest
listed revision. Without the key only 2025-11-25 is offered (v0.1.0
behaviour, kept for existing configurations). New configurations
(`sievant config template`, and `sievant init` from M3) list every
revision. `sievant proxy` offers every revision.

**Over HTTP**, each initialize-era session keeps its negotiated revision.
`MCP-Protocol-Version` must name it; clients before 2025-06-18 do not
send the header, and their requests are accepted without it.

**JSON-RPC batches are refused** for every revision, including 2025-03-26,
which allowed them: Sievant evaluates, rate-limits and audits each
request on its own (security charter rule 2). A batch gets error -32600
with the message "Batch refused by Sievant's security policy: JSON-RPC
batches are not accepted …"; send each request as a separate message.

**Not served:** the HTTP+SSE transport of 2024-11-05 (a separate SSE
endpoint). 2024-11-05 clients are served over stdio, or over Streamable
HTTP if they speak it.

## As a client (to upstream MCP servers)

With `serve_resources` and `serve_prompts`, Sievant also sends an
upstream `resources/list`, `resources/templates/list` and `prompts/list`
at startup, and `resources/read` and `prompts/get` when an agent asks;
it never subscribes to resources or relays `list_changed`
notifications (what is served is the startup listing).

Sievant opens with `initialize`, offering 2025-11-25, and accepts a server
that answers 2025-11-25, 2025-06-18, 2025-03-26 or 2024-11-05. It
declares no client capabilities: it answers `ping` and refuses sampling,
elicitation and roots requests. Servers that speak only the stateless
2026-07-28 revision are not supported yet. Only tools are served to
agents; see [MCP servers as upstreams](connectors.md#mcp-servers-as-upstreams).

### Not supported yet

- **Requests from upstream servers** (sampling, elicitation, roots) are
  refused, as above.
- **Tasks from servers that do not declare them.** A tool whose
  definition says `execution.taskSupport: "required"`, on a server that
  does not declare `capabilities.tasks.requests.tools.call`, is still
  served, but the server answers each call with a tool error (for
  example "requires task augmentation"). Sievant names such tools at
  startup (a warning), in `sievant proxy --list-tools` ("requires MCP
  tasks …") and in `sievant scan --inspect-tools` (MCP002, info). Servers
  that declare the capability get tasks; see "Tasks" below.
- **Task input and status notifications.** An upstream task that asks
  for input (elicitation or sampling, status `input_required`) never gets
  it, since requests from upstream servers are refused; agents see the
  task as `working` with the status message "The upstream server is
  waiting for input (elicitation or sampling), which Sievant does not
  relay". Upstream `notifications/tasks/status` are not relayed: both
  task specifications make them optional, and agents poll.
- **Progress during a task.** Progress is relayed while a `tools/call`
  runs; a task's later progress is not.
- Other upstream notifications are dropped (logged at debug level).

### Tasks

Sievant runs a tool as an MCP task when the upstream server declares
`capabilities.tasks.requests.tools.call` and lists the tool with
`execution.taskSupport` `"optional"` or `"required"`. Toward the
upstream it uses the 2025-11-25 task methods: `tools/call` with
`params.task`, then `tasks/get`, `tasks/result` and `tasks/cancel`.
Agents are offered tasks only when such a tool is served; otherwise
every answer is as it was (a `task` parameter is ignored, `tasks/*` are
"Method not found").

| | 2025-11-25 clients | 2026-07-28 clients |
|---|---|---|
| Offered | `capabilities.tasks` (`list`, `cancel`, `requests.tools.call`) at `initialize`; `execution.taskSupport` in `tools/list` | the `io.modelcontextprotocol/tasks` extension in `server/discover` (`capabilities.extensions`) |
| Creating | the client sends `params.task` (`ttl` optional) on `tools/call` of an optional or required tool; another tool: -32601 | Sievant decides: a tool that requires a task gets one when the request declares the extension in its client capabilities, and -32021 (missing required client capability) when it does not; an optional tool runs as a plain call |
| Polling | `tasks/get` | `tasks/get` (with `Mcp-Name: <taskId>` over HTTP) |
| Result | `tasks/result`: waits for the end by polling the upstream, at most `server.limits.call_timeout` (then BACKEND_TIMEOUT; call again), and fetches the result only then, so a waiting request holds no connector slot | inline in `tasks/get` once the task is done (`result`, or `error` when the call failed with a JSON-RPC error) |
| Listing | `tasks/list`: the caller's tasks, as last seen | none (the extension has no listing) |
| Cancelling | `tasks/cancel`: the cancelled task, or -32602 when it had already ended | `tasks/cancel`: acknowledged |
| Input | not relayed (see above) | `tasks/update` is acknowledged and ignored: Sievant shows no `inputRequests` |

**What Sievant enforces.**
- Agents see Sievant's own task IDs: 128 random bits, never the
  upstream's.
- A task belongs to the agent identity that created it. Another agent,
  a guessed or expired ID and an unknown one all get -32602 "Failed to
  retrieve task: Task not found".
- Creating a task runs the whole `tools/call` guardrail chain: identity,
  RBAC, rate limit, input sanitization, injection scoring, budgets and
  audit.
- Delivering a task's result runs the whole chain again, as a call of
  the same tool with the same arguments. RBAC is checked again, so a tool
  denied since the task was created delivers nothing. The output checks,
  budgets and audit apply to each delivery.
- `tasks/get`, `tasks/list`, `tasks/cancel` and `tasks/update` spend from
  one per-agent bucket of the agent's rate limit. They are not audited.
- Status messages are scrubbed of connector secrets, redacted, cleaned
  of control characters and cut to 256 characters.
- Limits: 100 live tasks per agent and 1,000 in total (BUSY beyond). A
  task is kept at most 24 hours, or the upstream's TTL when shorter.

### Progress

When a client sends `_meta.progressToken` on a `tools/call`, Sievant
sends the upstream a progress token of its own and relays the upstream's
`notifications/progress` to the client under the client's token, until
the response (never after it). A stdio server's updates arrive on its
stdout. A Streamable HTTP server's updates arrive in the event stream of
its response, which Sievant reads as it arrives, within the same SSRF
guard, response cap and memory budget. Relayed updates follow these
rules:

- values stay increasing, as the spec requires: an update that does not
  increase is dropped, and over HTTP, where Sievant sends its own
  keep-alive progress (1, 2, …) while a call runs, relayed values and
  totals are offset past the last keep-alive value, after which
  keep-alives stop carrying progress. Over HTTP a relayed update turns
  the response into an SSE stream at once, before `stream_after`;
- at most one update per 100 ms per request is relayed (the next one
  carries the newer value);
- messages are cleaned: connector secrets redacted and URL tokens masked,
  then the output redaction rules (credentials, PII), control and
  formatting characters replaced, at most 256 characters.

Requests without a progress token do no extra work.
