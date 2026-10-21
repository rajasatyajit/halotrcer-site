---
title: Connectors
source:
  repo: sievant
  path: docs/connectors.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: false
order: 5
---

The backends Sievant serves as MCP tools: SQL, REST, gRPC, Prometheus and Loki, and other MCP servers.

## SQL connectors

Drivers: Postgres ([pgx](https://github.com/jackc/pgx)), MySQL
([go-sql-driver/mysql](https://github.com/go-sql-driver/mysql)) and SQLite
([modernc.org/sqlite](https://modernc.org/sqlite), pure Go). Two kinds of
tools:

**Filter tools** (`tables`). At startup Sievant reads each table's columns
and types (information_schema on Postgres and MySQL, `pragma_table_info` on
SQLite), checks that every allowlisted column exists and that the role can
select it, and generates a tool whose JSON Schema accepts:

```json
{
  "filters":  [{"column": "status", "op": "in", "value": ["open", "closed"]}],
  "order_by": [{"column": "created_at", "direction": "desc"}],
  "limit": 20,
  "offset": 0
}
```

`column` is an enum of the allowlist; `op` is one of `eq neq in lt lte gt
gte prefix` as the column's type allows (`prefix` for text, `eq`/`neq` for
booleans); `value` is typed per column (integer, number, boolean, date or
date-time string, text). A wrong type, an unknown column or operator, or a
limit or offset above the configured maximum is rejected by schema
validation before any SQL exists. The query builder takes identifiers only
from the introspected allowlist, quotes them per dialect, and binds every
value as a parameter (`prefix` escapes `%`, `_` and `!` and uses `LIKE ...
ESCAPE '!'`). Results are `{columns, rows, row_count, has_more}` as
structured content and as JSON text.

**Named queries** (Mode A2, `tools`): SQL written by an administrator, with
typed positional parameters (`$1..$N` for Postgres, `?` for MySQL, `?` or
`?N` for SQLite). Agents supply parameter values, never SQL.

**Masks.** `masks: {column: full | last4 | null}` on a table or named query
replaces values right after they are read, before output sanitization runs.
Masked columns cannot be filtered or ordered by: comparisons against them
would reveal the hidden values.

**Filterable columns.** A column is a name or `{name, filterable,
include_binary}`. `filterable: false` removes the column from the filter
and order-by schema, so it cannot be probed with comparisons, but its values
are still returned. **Output redaction is not a confidentiality boundary
for filterable columns; mask columns whose values must stay secret.** A
caller can test a guessed value with `eq` (or narrow it down with `prefix`,
`lt`, `gt`) and learn it from which rows come back, whatever the output shows.

**Binary columns.** True binary types (Postgres bytea; MySQL binary,
varbinary, blob types, bit, spatial types; SQLite BLOB) are opaque to
sanitization, so they are excluded from output: filter tools never select
them, and named queries drop them from results. Set `include_binary: true`
on a table column, or list the column in a named query's `include_binary`,
to return it (base64 when not UTF-8).

**Text-representable columns** that are not plain scalars (json, jsonb,
arrays, intervals, network types, enums, SQLite columns without a
recognised type) are returned as text, so output sanitization redacts
secrets inside them, but they are never filterable or sortable.

**Caps.** At most `max_filters` filters per call (default 10) and
`max_in_values` values per `in` (default 100). `pagination: false` removes
`offset` entirely.

**Row budgets.** Every SQL tool has a data-egress budget per (agent, tool): a
token bucket over rows (golang.org/x/time/rate) that refills `rows` per
`window` and holds at most `rows`. The default is
`output.row_budget_default: {rows: 5000, window: 1h}`; a table or named
query's own `row_budget` overrides it, and `row_budget: unlimited` is the
only way to turn it off for a tool (logged at WARN on startup). Because the
bucket refills continuously, an agent cannot take a full budget at the end
of one window and another at the start of the next. A page larger than the
tokens available is trimmed to them; with none available the call returns
`isError: true`, "Row budget exhausted for this tool; retry after <time>."
The time is when the page the call asked for will be available: its
`limit` (or `default_limit`) for a filter tool, `max_rows` for a named
query, capped at `output.max_rows` and at the budget itself. A retry at that
time gets the full page rather than a single row. Results carry `_meta["sievant/row_budget"] = {limit, window, remaining,
truncated}`.

**Row budgets are per process.** They live in memory: they reset when
Sievant restarts, and each replica keeps its own, so the effective budget
multiplies by the replica count. Budgets shared across replicas are future
control-plane work.

**Read-only enforcement**, for every query:

1. a **read-only transaction** (`BEGIN READ ONLY` / `START TRANSACTION READ
   ONLY`);
2. a **statement timeout**: Postgres `SET LOCAL statement_timeout`, MySQL
   `SET SESSION max_execution_time`, SQLite interrupts on the context
   deadline; the request's own deadline also applies. A timeout is reported
   as BACKEND_TIMEOUT;
3. a **read-only role**. SQLite has no roles, so the DSN must open the file
   with `mode=ro`, and Sievant also sets `PRAGMA query_only = ON` on every
   connection as a second, independent guard; startup refuses to serve
   unless both hold on a live connection.

The config-time SELECT/WITH check on named queries is **lint only**. It
cannot prove a query is read-only (a Postgres data-modifying CTE starts with
`WITH`); the read-only transaction is what stops it, even for a role that
could write. MySQL DSNs may not enable `multiStatements`, and
`interpolateParams` is forced off so values always reach the server as bound
parameters.

**Startup privilege check.** Sievant warns loudly (`DB_ROLE_CAN_WRITE`)
when the role could write:

| Engine | Method |
|---|---|
| Postgres | `pg_roles` attributes (SUPERUSER, CREATEROLE, CREATEDB, BYPASSRLS); `has_table_privilege(…, 'INSERT'/'UPDATE'/'DELETE'/'TRUNCATE')` over all user tables and views, which includes grants through roles and PUBLIC; `has_schema_privilege(…, 'CREATE')`; `has_database_privilege(current_database(), 'CREATE')`. |
| MySQL | `SHOW GRANTS FOR CURRENT_USER()`: any privilege other than USAGE, SELECT, SHOW VIEW, SHOW DATABASES; role grants are reported as not inspected. |
| SQLite | No roles: `mode=ro` and `query_only` are verified instead, and serving is refused if either is off. |

**Cancellation reaches the database.** When a request's context ends (the
HTTP client disconnected, the call timed out, the server is shutting down)
the running statement stops in the database, not just in Sievant: pgx sends
a Postgres cancel request, the SQLite driver interrupts the statement, and
for MySQL, whose driver only drops its side of the connection while the
server keeps executing, Sievant sends `KILL QUERY <connection id>` on a
separate one-connection pool (a user may kill its own statements without
extra privileges). Each pooled connection reads its ID once, when it is
established, so queries pay no extra round trip. The
cancel finishes before the connection returns to the pool, so it can never
hit another caller's statement. Tested end to end over HTTP on all three
engines.

**Pool.** `max_open_conns`, `max_idle_conns` and `conn_max_lifetime` set the
connection pool; connectors expose `PoolStats()` (`database/sql.DBStats`).

**Tests.** `go test ./pkg/connectors/sql` runs the suite against a seeded
SQLite file and against Postgres 17 and MySQL 8.4 in containers
(testcontainers; needs Docker). Skip the containers with `-short` or
`-args -no-containers`.

### Raw SQL (opt-in)

The highest-risk feature: an allowlisted agent runs its own SELECTs.
It is off by default, available for MySQL and SQLite only, and only in
the **full build**: `make build-full` builds `bin/sievant-full` with the
`rawsql` build tag. The default build (`make build`, `bin/sievant`)
leaves out raw SQL and both SQL parsers, and a configuration with
`raw_sql: true` is an error there that names the full build.

| Build | Binary | Idle RSS (mock / SQLite / SQLite with raw SQL) |
|---|---|---|
| core (`make build`) | 29.1 MB | 34.9 / 35.0 MiB / (refused) |
| full (`make build-full`, `-tags rawsql`) | 42.6 MB | 33.6 / 33.9 / 33.3 MiB |

(Medians of three runs, stdio, audit store on.)

```yaml
connectors:
  sql:
    - name: shop
      driver: mysql
      dsn: ${SHOP_DB_DSN}          # a read-only role: verified, or raw_sql refuses to start
      raw_sql: true                 # or {tool: shop_sql, max_rows: 100, row_budget: {rows: 5000, window: 1h}}
      tables: [...]                 # the allowlist raw SQL may query
policies:
  - agent: analyst
    allow: [shop_sql]               # exact name only: a wildcard never allows a raw SQL tool
```

The tool (`<connector>_sql` by default) takes `{"query": "SELECT ..."}`
and returns rows like a filter tool. Startup logs a WARN for every raw SQL
tool, and another for every wildcard allow that matches one.

**The parser check is defense in depth, not the enforcement.** The
enforcement is the same as for every query, plus two things raw SQL
needs:

- **A read-only role, verified.** With raw SQL on, a role that can write
  is a startup error, not a warning. On MySQL a read-only transaction does
  not stop DDL: DDL commits the open transaction implicitly, and the test
  below saw `DROP TABLE` succeed inside `START TRANSACTION READ ONLY` with
  a role that could write. For SQLite, the `mode=ro` open and
  `query_only` stand in for the role, as before.
- **No ATTACH on SQLite.** None of SQLite's read-only guards stops
  `ATTACH`, which can create a file or open, and read, any other SQLite
  file the process can reach (the differential test did both). Every SQLite
  query, curated or raw and in both builds, runs on a pinned connection
  set to `SQLITE_LIMIT_ATTACHED = 0` through modernc.org/sqlite's public
  `sqlite.Limit`, and the limit is read back before the query runs, so the
  engine itself refuses `ATTACH` (`TestAttachLimit`).

**Parsers.** Pure Go, maintained, chosen for how closely they follow the
server's own grammar:

| Dialect | Parser | Why |
|---|---|---|
| MySQL | TiDB's parser, `github.com/pingcap/tidb/pkg/parser` (Apache-2.0) | Built to accept MySQL's grammar, including executable `/*! */` comments, which it reads as MySQL does; maintained with TiDB. Together with rqlite's, it is what the full build adds: 13.5 MB of binary and up to about 3 MiB of idle RSS. Its logger, which writes to stdout by default, is sent to stderr. |
| SQLite | rqlite's parser, `github.com/rqlite/sql` (MIT) | Covers SQLite's SELECT grammar and refuses what it does not know (`[bracketed]` names, `ESCAPE`); maintained with rqlite; about 1 MB. |
| PostgreSQL | none: raw SQL is refused | The exact grammar in pure Go is libpg_query compiled to WebAssembly (`wasilibs/go-pgquery`): its first parse compiles the module, peaking at about 250 MB RSS even under GOMEMLIMIT, with ~50 MB resident afterwards, and it writes to stdout. CockroachDB's parser costs 25 MB of idle RSS whenever it is linked (package initialisation), and its grammar differs (`U&"d\0061t"` parses as `u & "d\0061t"`). Both break the memory targets. |

**What runs is what was checked.** The validator parses the query, checks
the syntax tree, prints it back as canonical SQL (every identifier quoted,
no comments or hints, strings with quotes and backslashes doubled so their
structure does not depend on `sql_mode`), parses and checks that text
again, and requires the second print to equal the first. Only the
canonical text runs, inside the gateway's LIMIT:
`SELECT * FROM (\n<canonical>\n) AS sievant_raw LIMIT <max_rows + 1>`.
A comment the database would execute, or a token the parser reads
differently, is not in what runs. MySQL executable comments and optimizer
hints are refused outright.

**The rules** (an allowlist; anything else is refused with a reason):

- Exactly one `SELECT`. `WITH` is allowed if every CTE is a `SELECT`;
  `WITH RECURSIVE` is not. `UNION`, `INTERSECT` and `EXCEPT` of SELECTs,
  subqueries in FROM, WHERE and the select list, joins with `ON` or
  `USING`.
- Tables: only those configured, by their exact configured name. System
  catalogs are refused by name (`mysql.*`, `information_schema`,
  `performance_schema`, `sys`, `sqlite_*`), and so are table-valued
  functions (`pragma_table_info`, `json_each`).
- Columns: only allowlisted ones, named explicitly (no `*`); computed
  columns need an alias, and output names must be distinct. Names are
  ASCII identifiers, so case folding means the same to the validator and
  the database. An unqualified name must belong to a table of its own
  SELECT (an outer query's column must be qualified), and is checked
  against every column the table has, so a column missing from the
  allowlist is refused instead of being resolved elsewhere.
- Masked and `filterable: false` columns may only be selected directly
  (optionally aliased) in the outermost select list. Anywhere else (WHERE,
  JOIN, ORDER BY, GROUP BY, HAVING, a function, CAST, CASE, a subquery or
  CTE, `DISTINCT`, a set operation, an output alias or position used in
  ORDER BY) they could reveal their values, and the query is refused.
- Functions: aggregates (`count`, `sum`, `avg`, `min`, `max`), and
  string, number, conditional and date functions without side effects.
  Everything else is refused: `SLEEP`, `BENCHMARK`, `LOAD_FILE`,
  `load_extension`, `randomblob`, `printf`, stored functions, variables.
- Operators: comparison, arithmetic, `AND`/`OR`/`NOT`, `LIKE`, `IN`,
  `BETWEEN`, `IS [NOT] NULL`, `||` on SQLite. Not `REGEXP`, `GLOB`,
  `MATCH`, bit operators or JSON arrows. `CAST` to plain number, text and
  date types only.
- Not allowed: parameters, `INTO` (OUTFILE, DUMPFILE, variables), locking
  reads, window functions, `NATURAL JOIN`, `LATERAL`, index hints,
  `TABLESAMPLE`, `VALUES` and `TABLE` statements, `LIMIT` other than
  integer literals.

**Results.** Masks apply by output position, not by name, so
`SELECT email AS name` is still masked. Binary values are dropped (by
column type, or by value on SQLite) unless the position is a directly
selected `include_binary` column. At most `max_rows` rows are returned,
with `has_more`. Row budgets (`raw_sql.row_budget`, else
`output.row_budget_default`), output sanitization and the output budget
apply as for any tool.

**Refusals are security events.** A refused query is a tool error that
says why (the agent's own text and allowlist), and a `RAW_SQL_REFUSED`
security event: reserved security queue, flood-limited like the others,
counted by `sievant_raw_sql_refused_total{class}`, listed in the
dashboard's security panel. The event carries only the refusal class
(`encoding`, `syntax`, `multiple_statements`, `statement_type`,
`comment`, `catalog`, `table`, `column`, `sensitive_column`, `function`,
`operator`, `construct`), never the query.

**Measured.** Each dialect has a bypass corpus in
`pkg/connectors/sql/testdata/rawsql/` (`TestRawBypassCorpus`): every case
must be refused by the validator.

| Category | MySQL | SQLite |
|---|---|---|
| Comments, nested comments, executable comments, hints | 10 | 5 |
| Unicode and case tricks | 14 | 11 |
| Stacked statements | 6 | 5 |
| Data-modifying statements in CTEs | 4 | 5 |
| Writes (DML, DDL, GRANT, ATTACH, VACUUM INTO, INTO OUTFILE, LOAD DATA) | 17 | 19 |
| Side-effect functions (pg_sleep, dblink, lo_import, pg_read_file, SLEEP, BENCHMARK, LOAD_FILE, load_extension, PRAGMA, ...) | 31 | 38 |
| System catalogs | 9 | 12 |
| Masked or `filterable: false` columns outside the select list | 33 | 37 |
| Columns or tables not allowlisted | 6 | 6 |
| **Total, all refused** | **130** | **138** |

**Differential test.** The corpus's write attempts (25 MySQL, 28 SQLite)
also run with the validator and the LIMIT wrapper turned off, straight
into the read-only transaction. Every one fails at the database, and
neither the table nor the file system changes. On MySQL, 18 fail on the
read-only role's missing privileges or the read-only transaction; the
other 7 are syntax errors (stacked statements, since `multiStatements` is
off, and syntax MySQL does not have). On SQLite, 19 fail on the read-only
open ("attempt to write a readonly database"); the other 9 fail on the
ATTACH limit, the read-only transaction (`VACUUM`), "not authorized"
(`load_extension`), an unknown function (`writefile`) or unknown syntax.
With a role that can write, raw SQL on MySQL refuses to start.

### Raw SQL limits

- The validator is only as exact as its parser's grammar. What runs is the
  canonical text it printed and checked again, which removes comment and
  lexer tricks, but a construct that both parsers read the same way while
  the database means something else would still get through the
  validator. The database guards above are what stop writes in that case.
- MySQL table names are compared exactly (`lower_case_table_names = 0`, the
  Linux default). A server that folds table names only makes the validator
  stricter than needed.
- With `NO_BACKSLASH_ESCAPES` in the server's `sql_mode`, a string literal
  containing a backslash reaches MySQL with the backslash doubled. The
  query's structure does not change, only that value.
- An agent can still run expensive queries (cross joins, aggregates over
  large tables). The statement timeout and the connection pool bound them.

## REST connectors

`connectors.rest` exposes operations of an HTTP API described by an
OpenAPI 3.0 or 3.1 document (loaded with kin-openapi; external `$ref`s are
refused and the document must validate).

```yaml
connectors:
  rest:
    - name: tickets
      spec: /etc/sievant/openapi/tickets.yaml
      base_url: https://tickets.internal.example.com/api/v2
      timeout: 5s
      max_concurrency: 8
      allow_private_networks: [10.40.0.0/16]
      auth: {type: bearer, token: "${TICKETS_API_TOKEN}"}
      operations:
        - {operation_id: getTicket, tool: tickets_get, input_pii: redact}
        - {operation_id: closeTicket, input_pii: block, allow_method: POST}
```

**Allowlist.** Only operations listed by `operation_id` become tools (named
after the operationId, or `tool`). GET operations need nothing more; any
other method must be opted into with `allow_method`, which must equal the
operation's method, so a document that later changes a POST into a DELETE
does not silently widen access. A listed operation the connector cannot
serve exactly is a startup error: an unknown operationId, a method not
opted into, a required header or cookie parameter, a required parameter
with an object value, a non-JSON required body, a recursive schema, a
pattern RE2 cannot compile, no summary or description.

**Tool schemas.** Path and query parameters become top-level arguments
and the JSON request body becomes `body`, with `additionalProperties:
false`. Schemas are converted to JSON Schema 2020-12 with references
inlined: `nullable` becomes a `null` type, 3.0 boolean `exclusiveMinimum`
becomes the numeric form, `readOnly` properties are removed from request
bodies, and annotation-only keywords (example, xml, discriminator) are
dropped. Every constraining keyword is carried over, so the gateway's
schema check refuses what the API would. Optional header and cookie
parameters are left out: the agent never sets headers.

**Validation.** Every request is also validated with kin-openapi
(`openapi3filter.ValidateRequest`) before it is sent; a failure is a tool
error naming the parameter or body field and the rule, never the value.
With `validate_responses: true`, a response that does not match the
document (status or body) is not returned. Arrays and scalars in a JSON
response are wrapped as `{"items": [...]}` / `{"value": ...}` for
`structuredContent`, and `text/*` responses are returned as text. Any other
content type is omitted (a tool error and a `RESPONSE_REFUSED` event)
unless the operation lists it in `allow_content_types`, and even then only
UTF-8 content is returned: binary content never reaches the agent. A 4xx
body (JSON or text, up to 2 KB) is shown to the model as output like any
other: it passes through `sanitize_output` and the bytes budget. A 5xx body
never is.

**Response size.** `max_response_bytes` (default 4 x `output.max_bytes`,
256 KiB with the defaults; after decompression) bounds a response. A declared `Content-Length` over it is
refused before the body is read; otherwise the body is read through
`io.LimitReader` to the cap and no further, into a buffer that never grows
past it, so memory stays O(cap) whatever the API sends (tested: a 50 MiB
stream stops the API after about 12 MiB written, with RSS growth well under
the response size). Exceeding it is a tool error and a `RESPONSE_REFUSED`
(`max_response_bytes`) event.

**Path parameters** are one opaque segment each, escaped with
`url.PathEscape` (`a/b` is sent as `a%2Fb`, `?` and `#` stay in the
segment). A value that could act as a dot segment on some server is
refused before anything is sent: `.` and `..` segments split at `/` or
`\`, found after up to three rounds of percent-decoding and Unicode
compatibility normalization (fullwidth and leader dots, fullwidth
solidus), with Tomcat-style `;params` or trailing spaces, and any control
character (NUL included). After the URL is built, its path is checked again
to be under the base path, both as sent and as a decoding server would
clean it. Refusals are `SSRF_BLOCKED` (`path_escape`) events.

**Outbound safety.**

- Requests go only to `base_url` (https only); the document's `servers`
  are ignored, and no proxy is ever used (it would connect on Sievant's
  behalf to an address the guard never saw).
- **SSRF guard after DNS resolution.** Each new connection resolves the
  host once and is refused if any address is private, loopback,
  link-local, carrier-grade NAT, multicast, reserved, documentation,
  6to4/NAT64/Teredo, or a cloud metadata endpoint (169.254.169.254,
  169.254.170.2, fd00:ec2::254, 100.100.100.200, Azure's 168.63.129.16,
  …), unless it falls in `allow_private_networks`. A metadata address is
  only allowed by listing it on its own (/32 or /128), never by a wider
  range. The connection is made to the address that was checked, and the
  socket re-checks it before connecting, so a DNS answer that changes
  between check and use (rebinding) cannot redirect it.
- **Redirects** are followed only to the same scheme and host, under the
  base path, at most three times; anything else is refused.
- **Audit.** Every refusal (blocked address, redirect to another host,
  outside the base path or past the limit, path escape) is an
  `SSRF_BLOCKED` security event whose rule is the reason class
  (`blocked_address`, `redirect_host`, `redirect_path`, `redirect_limit`,
  `path_escape`) and whose reason names the host only, never the URL. The
  events are flood-limited like every security event (the first
  `audit.flood.full_records` per window in full, then a summary), appear in
  the dashboard's security panel, and count in
  `sievant_ssrf_blocked_total{reason}`.
- **Limits.** `timeout` bounds each call (connect, TLS, headers, body; a
  timeout is BACKEND_TIMEOUT). `max_concurrency` bounds calls in flight;
  one more is refused at once with BUSY (`-31002`), never queued.

**Credentials.** `auth.type` is `none`, `bearer`, `api_key` (`header` +
`key`), `basic` or `mtls` (`client_cert_file` + `client_key_file`);
`ca_file` replaces the system roots for any type. The credential is added
by Sievant after validation. It is never part of a tool schema, and every
occurrence of a secret value (and its URL-encoded and basic-auth base64
forms) in a response is replaced with `[REDACTED:rest_secret]`, JSON
escapes decoded first; each replacement is an `OUTPUT_REDACTED` event with
the rule and path, never the value. Errors and logs never include the
request URL (its query holds the agent's arguments) or headers. Secrets
must be at least 8 bytes.

**Arguments leave the gateway.** Every REST operation must set
`input_pii` (`audit`, `redact` or `block`): there is no silent default,
because arguments are sent to another service. Credentials in arguments are
always blocked: `sanitization.tools` may not relax `input_credentials` for
a REST tool (a config error).

**Bytes budgets.** Tools that do not return rows (REST operations, the mock
connector) get the row budget's design over bytes: a token bucket per
(agent, tool) holding `bytes` and refilling `bytes` per `window`. The
default is `output.bytes_budget_default: {bytes: 16777216, window: 1h}`
(it cannot be unlimited); an operation's `bytes_budget` overrides it, and
`bytes_budget: unlimited` is the only opt-out (logged at WARN). It counts
what the agent actually receives: the stage wraps `sanitize_output`, so
redacted output is counted at its redacted size, and a structured result
counts with its text mirror. A result larger than what is left is cut at
a safe point (a JSON object that does not fit is dropped whole rather than
broken) with `[Sievant: byte budget reached; returned X of Y bytes]`; an
empty bucket refuses the call before it reaches the API with "Byte budget
exhausted for this tool; retry after <time>", the time when a result the
size of the last one fits again. Checking and spending happen under one
lock, so concurrent calls cannot exceed the budget together. Results carry
`_meta["sievant/bytes_budget"] = {limit, window, remaining, truncated}`;
exhaustion is a `BYTES_BUDGET_EXHAUSTED` event. Like row budgets, bytes
budgets are per process.

**Tests.** `go test ./pkg/connectors/rest` runs against httptest TLS
servers with an injected resolver: schema generation (3.0 and 3.1),
startup refusals, validation failures (nothing invalid reaches the API),
SSRF attempts including DNS rebinding and IPv4-mapped/NAT64 forms, redirect
blocking, secret redaction for every auth type, busy and timeout, mutual
TLS. `cmd/sievant` tests page a REST endpoint through the real binary until
the bytes budget stops it, run 40 concurrent calls against one budget, and
check that the token reaches neither the protocol stream, the logs nor the
audit database.

## gRPC connectors

`connectors.grpc` exposes allowlisted methods of a gRPC service. Nothing is
generated: requests are `dynamicpb` messages built from the agent's JSON
with `protojson`, and responses are rendered back to JSON the same way.

```yaml
connectors:
  grpc:
    - name: billing
      target: billing.internal.example.com:443
      tls: {ca_file: /etc/sievant/tls/billing-ca.pem}   # add client_cert_file/client_key_file for mTLS
      descriptors: {source: reflection}                 # or {source: protoset, protosets: [billing.protoset]}
      timeout: 5s
      methods:
        - {method: billing.v1.Invoices/GetInvoice, tool: invoices_get, input_pii: redact}
        - {method: billing.v1.Invoices/ListInvoices, tool: invoices_list, input_pii: redact}
```

**Descriptors** come from the server's reflection service at startup
(`grpc.reflection.v1`, through the client generated in
`google.golang.org/grpc/reflection/grpc_reflection_v1`; imports the server
omits are requested file by file, and the well-known types resolve
locally), or from compiled FileDescriptorSets (`protoc
--descriptor_set_out=billing.protoset --include_imports`). With protosets,
`sievant validate` checks every method without connecting.

**Allowlist.** Only the listed methods (`package.Service/Method`) become
tools, named after the method with `/` as `.` unless `tool` is set; the
description comes from the method's comment when the descriptors carry
source info, or from `description`. Unary methods return one message;
server-streaming methods return `{"items": [...], "truncated": bool}`,
collected up to `max_stream_messages` (default 100) and `max_stream_bytes`
of JSON (default 1 MiB), after which the stream is cancelled. Client and
bidirectional streaming methods are refused: at config validation with
protosets, at startup with reflection.

**Schemas.** The request message becomes the tool's JSON Schema
(2020-12): JSON (lowerCamel) field names; 32-bit integers with their
bounds; 64-bit integers as a number or a decimal string (protojson's
forms); floats with `NaN`/`Infinity`; enums by name; nested messages
through `$defs` and `$ref`, so recursive messages work; repeated fields as
arrays; maps as objects with typed keys (`propertyNames`); each oneof as
"at most one member"; proto3 `optional`; Timestamp as an RFC 3339 string,
Duration as `"1.5s"`, wrappers as their value or null, Struct as an
object, Value as any JSON, ListValue as an array, Empty as `{}`, FieldMask
as a string.

**Bytes.** Bytes-like fields (`bytes`, `BytesValue`, `Any`, and maps of
them) render as base64, which the sanitizer cannot read. They are left out
of request schemas (and refused if sent), and omitted from responses
unless listed in `allow_bytes_fields` (response field paths such as
`attachment.data`); omissions are listed in
`_meta["sievant/grpc"].omitted_bytes_fields` and a notice.

**Transport.** TLS (`ca_file` replaces the system roots; a client
certificate makes it mutual TLS), never through a proxy, dialed through
the same SSRF guard as REST (`allow_private_networks`). `plaintext: true`
drops TLS for a backend on a private network only: every address the
target resolves to must be in a private range (RFC 1918, CGNAT, unique
local IPv6, loopback) and not a metadata address. A public IP literal is a
config error, a name resolving to a public address fails at startup, every
later dial is held to the same rule, and startup logs a WARN. The per-call
`timeout` is the gRPC deadline the backend sees. `max_recv_bytes` (default
4 x `output.max_bytes`, 256 KiB with the defaults) caps a received message; a larger one is a tool error and a
`RESPONSE_REFUSED` event. `max_concurrency` calls at most, then BUSY.

**Errors.** Codes the model can act on (InvalidArgument, NotFound,
AlreadyExists, PermissionDenied, FailedPrecondition, OutOfRange, Aborted,
Unimplemented, ResourceExhausted) are tool errors with the backend's
message, which passes through `sanitize_output` and the budgets like any
output. Unavailable and Unauthenticated are tool errors without it.
Internal, Unknown and DataLoss details never reach the agent or the log.

**Arguments leave the gateway.** Every method must set `input_pii`, and
credentials in arguments are always blocked, as for REST.

**gRPC version.** Sievant uses the released `google.golang.org/grpc`
v1.84.0. Until 2026-10-20 it was pinned to a development commit
(`v1.85.0-dev.0.20260825072537-93e31b48545e`) because the Go vulnerability
database listed v1.84.0 as affected by GO-2026-6443 (a server panic, which
every grpc-go binary links even when, like Sievant, it is only a client);
the entry, revised on 2026-10-06, lists the fix in the 1.84 line before
v1.84.0, and `make vuln` (source and binary) is clean with it.

**Tests.** `go test ./pkg/connectors/grpc` runs against an in-process TLS
server (`internal/testutil/grpctest`) implementing a test proto that covers
every type category, compiled from source at test time
(`bufbuild/protocompile`, a test-only dependency), with reflection; both
descriptor paths, schema conversion and enforcement, round trips, bytes
omission, stream caps, streaming kinds, deadlines, receive caps, status
mapping, mTLS and the SSRF guard.

## Prometheus and Loki connectors

Diagnostic agents can query metrics and logs, within allowlists.
`connectors.prometheus` and `connectors.loki` call their API through the
same HTTP client as the REST connector (`pkg/connectors/upstream`): the
SSRF guard on every connection, no proxy, TLS (system roots or
`auth.ca_file`, optional client certificate), the credential Sievant adds
(bearer, api_key, basic, mTLS) and its redaction from anything the API
sends back, redirects only within the base URL, `max_concurrency`,
`max_response_bytes` and the response memory budget. `plaintext: true`
allows an `http://` base URL only toward private addresses (checked at
startup and on every connection), as for gRPC. `input_pii` is required,
as for REST (a query can carry personal data); credentials in arguments
are always blocked; `bytes_budget` overrides `output.bytes_budget_default`.

```yaml
connectors:
  prometheus:
    - name: metrics                 # tools metrics_query, metrics_query_range
      base_url: https://prometheus.internal:9090
      timeout: 10s
      auth: {type: bearer, token: "${PROMETHEUS_TOKEN}"}
      input_pii: redact
      metrics: [up, http_requests_total, "node_cpu_*"]
      labels: {job: [api, db], instance: ["*"]}
      required_labels: [job]
      max_range: 24h                # default
      min_step: 15s                 # default
      max_points: 11000             # default, per series
      max_series: 100               # default
  loki:
    - name: logs                    # tool logs_query_range
      base_url: https://loki.internal:3100
      timeout: 10s
      auth: {type: basic, username: sievant, password: "${LOKI_PASSWORD}"}
      input_pii: redact
      tenant: team-payments         # X-Scope-OrgID
      labels: {app: [payments, checkout], env: ["*"]}
      required_labels: [app]
      max_range: 1h                 # default
      max_lines: 500                # default
      max_filters: 10               # default
```

**Prometheus.** The tools take PromQL, parsed with Prometheus's own
parser (`github.com/prometheus/prometheus/promql/parser`, experimental
features off: the server's grammar). It costs 72 KB of binary (the
gateway already links Prometheus's client libraries), so it is in the core
build. Every node of the query is checked, and anything unrecognized is
refused:

- every selector names an allowlisted metric (exactly, or by a listed
  prefix; `__name__` only with `=`), and matches the `required_labels`
  with `=`;
- matchers use allowlisted labels only; a label with listed values may
  only be matched with `=` to one of them, `"*"` allows any value and any
  operator;
- grouping (`by`, `without`) and vector matching (`on`, `ignoring`,
  `group_left`) use allowlisted labels only;
- functions come from `functions` (default: rates, `*_over_time`,
  `histogram_quantile`, math, sorting; not `label_replace` or
  `label_join`), aggregations from a fixed list (sum, avg, min, max,
  count, group, stddev, stdvar, topk, bottomk, quantile, count_values);
- range selectors, subquery ranges and offsets are at most `max_range`;
  subqueries need an explicit step of at least `min_step`; the `@`
  modifier is refused.

The query runs as the parser prints it back, after that text is parsed
and checked again to the same result (comments and formatting do not
reach Prometheus). A range query's window is at most `max_range`, its
step at least `min_step` (default: about 250 points), and
`(end - start) / step` at most `max_points` per series. An instant
query's `time` is at most `max_range` from now, in the past or the future.
Times are RFC 3339, `now` or `now-<duration>`. A result is cut to
`max_series` series, and says so (`series`, `total_series`,
`truncated`). **Result series keep only allowlisted labels** (and
`__name__`): a series can carry labels no one allowlisted (a
`customer_id`, an email), and those never reach the agent.
`return_all_labels: true` returns every label (logged at WARN); without
it, two series that differ only in a dropped label look alike.

**Loki.** LogQL is not parsed: the tool takes a stream selector
(`[{label, op, value}]`, `op` one of `= != =~ !~`) and line filters
(`contains`, `not_contains`, `regex`, `not_regex`), and the gateway
writes the query, quoting every value (the agent never supplies query
text). The same label rules apply: allowlisted labels, restricted values
only with `=`, `required_labels` with `=` (at least one is required: every
query is scoped). Regexes must be valid RE2, Loki's (linear-time) engine;
values are at most 1 KB, filters at most `max_filters`. The window is at
most `max_range` (default: the last hour), and at most `max_lines` lines
come back, newest first unless `direction: forward`, with `truncated`
when there were more. **Log lines always pass through output
sanitization** like any tool result (logs are full of secrets), and the
bytes budget stops an agent that pages through them. Each line keeps only
its allowlisted stream labels (`return_all_labels: true` returns them
all, logged at WARN).

**Loki 3.7+ and a full disk.** Loki 3.7 added
`ingester.wal.disk_full_threshold` (default `0.9`): while the disk under
its WAL is 90% full or more, Loki refuses every push with HTTP 500 and
the misleading `rpc error: code = Unknown desc = Ingester is shutting
down`, although the ingester is running and `/ready` still returns 200.
Sievant only queries Loki, so for a Loki of your own the symptom is
different: ingestion silently stops, and the logs tool returns results
that end at the moment the disk crossed the threshold (or nothing for a
recent window). Loki logs `disk usage exceeded threshold, throttling
writes` once, with the usage, and exports
`loki_ingester_wal_disk_usage_percent`; free space under the WAL
directory (or move it to its own volume) and writes resume within about
ten seconds. Inside a container the WAL is on the host's disk unless it
has its own volume.

**Refusals are security events.** A refused query is a tool error that
says which rule it broke, and a `TELEMETRY_REFUSED` security event
(reserved security queue, flood-limited, listed in the dashboard's
security panel) carrying the connector kind and the refusal class
(`syntax`, `metric`, `label`, `function`, `aggregation`, `modifier`,
`range`, `step`, `points`, `stream`, `filter`), never the query;
`sievant_telemetry_refused_total{class}` counts them.

**Tests.** `go test ./pkg/connectors/observability` runs against
Prometheus 3.15 and Loki 3.7 in containers (testcontainers; `-short`
skips them; the Loki container keeps `/loki` on its own tmpfs, so a
nearly full host disk cannot trip the threshold above): every allowlist
refusal and every cap, series and line
truncation, labels outside the allowlist (a seeded `customer_id`) kept
from results, `TELEMETRY_REFUSED`, `SSRF_BLOCKED` and `RESPONSE_REFUSED`
events. The end-to-end
harness adds the rest through the real binary: secrets seeded into log
lines (an email, a card number, an AWS key, a password) come back
redacted, and the bytes budget stops paging.

## MCP servers as upstreams

`connectors.mcp` fronts other MCP servers: Sievant runs a stdio server
as a child process (`command`) or calls a Streamable HTTP server (`url`),
and serves its tools to agents through the same guardrail chain as every
other tool (RBAC, rate limits, input sanitization, which blocks
credentials in arguments by default, prompt-injection detection, output
budgets, redaction, audit). Arguments are validated against the
upstream's input schema before the upstream sees them.

```yaml
connectors:
  mcp:
    - name: files
      command: [npx, -y, "@example/server-files@1.2.3", /srv/docs]
      env: {API_TOKEN: "${FILES_TOKEN}"}   # redacted from anything the server sends back
      inherit_env: [NODE_OPTIONS]          # on top of PATH, HOME, locale and temp variables
      public_env: [NODE_OPTIONS]           # not secrets: not redacted (every other env/inherited value is)
      tool_prefix: files.
      tools:                               # optional allowlist, optionally pinned
        - name: read_file
          sha256: <from sievant proxy --list-tools>
    - name: remote
      url: https://mcp.example.com/mcp
      auth: {type: bearer, token: "${REMOTE_MCP_TOKEN}"}
```

- **Tool definitions are read once, at startup**, and agents are served
  that copy: a server that later changes a description cannot change what
  agents see. A tool listed with `sha256` is withheld unless its definition
  (name, title, description, input schema; canonical JSON) matches. When a
  stdio server exits it is restarted on the next call (at most once a
  second) and its tools are listed again; a tool whose definition changed
  since startup is refused until Sievant restarts.
- **Pins on first use** (`pinning.first_use: true`, the
  `description-pinning` pack, or `sievant proxy --pin-first-use`): the
  first definitions seen of each connector's tools are recorded in
  `<state dir>/pins/<connector>.json` (`pinning.dir`). On a later start a
  tool whose description or schema differs is withheld, with a warning
  naming both hashes, until you review it and run
  `sievant policy pins accept <connector> [tool ...]`; `sievant policy pins`
  lists pins and changed tools. A tool not seen before is pinned (with a
  warning once the connector has pins). A pin in `tools[].sha256` takes
  precedence. A pin file that cannot be read stops the connector from
  starting (fix or remove it).
- **stdio**: an explicit argv, never a shell; only the listed environment
  reaches the child (Sievant's own keys and `SIEVANT_*` settings do not);
  the child runs in its own process group, which shutdown terminates, and
  on Linux it is killed if Sievant dies. Its stderr is logged at debug.
  When it exits on its own, a warning ("upstream MCP server exited") and
  the error of the failed start or call give its exit status and its
  last 20 stderr lines, with connector secrets redacted and URL tokens
  masked; agents only see that the tool failed. `sievant proxy` run
  without `--` adds a hint, since every argument from the server's
  command on goes to the server (`sievant proxy [flags] -- <command>`).
- **Progress**: a server's `notifications/progress` (stdio, or in a
  Streamable HTTP server's event stream as it arrives) reach a client
  that sent a `progressToken`, cleaned like tool output and kept
  increasing, so long-running tools do not look hung (docs/compatibility.md).
- **Tasks**: a tool the server runs as an MCP task (it declares tasks)
  can be called as one, by 2025-11-25 clients (`params.task`,
  `tasks/get`, `tasks/result`, `tasks/list`, `tasks/cancel`) and by
  2026-07-28 clients (the `io.modelcontextprotocol/tasks` extension).
  Agents get Sievant's own task IDs, bound to the agent; creating a task
  and delivering its result each go through the full guardrail chain
  (docs/compatibility.md, "Tasks").
- **Streamable HTTP**: the REST client (`pkg/connectors/upstream`): SSRF
  guard, TLS, the credential and its redaction, `max_response_bytes`, the
  response memory budget. JSON and event-stream responses are both read;
  an expired session is re-established once.
- Only **text** passes: an embedded text resource becomes text, and
  images, audio, binary resources and resource links are replaced by a
  note saying what was removed (`[image content withheld by Sievant
  (image/png, 48213 bytes): only text is passed through]`), logged with
  the tool, type and size, and recorded as a `CONTENT_WITHHELD` audit
  event (content type, media type and size; never the content or its
  URI). The output guardrails inspect text only.
  `structuredContent` passes (an object only).
- Upstream **resources and prompts** are served only when the connector
  sets `serve_resources: true` or `serve_prompts: true` (`sievant proxy
  --serve-resources`, `--serve-prompts`); otherwise they are withheld,
  never silently: startup logs a warning naming every resource, resource
  template and prompt withheld, and `sievant proxy --list-tools` lists
  them. Served ones are the ones listed at startup (like tools): a read
  goes upstream only for a listed URI or one that fits a listed template
  (no `.`/`..` segments or encoded slashes and dots in its values), and
  prompt names take `tool_prefix`. What a read or a prompt returns goes
  through the output checks tool results go through, in the same order:
  `output.max_bytes` across all its items (items past it dropped, the
  notice at the end of the last), redaction, then the agent's injection
  action (annotate wraps the content in provenance delimiters, inside its
  first and last items; block answers error -31006, "The resource looks
  like a prompt-injection attempt and was withheld."; observe records
  WOULD_BLOCK). Binary items become a note, as in tool results. Agents
  need `resources:` and `prompts:` rules in their policy, as for any
  resource or prompt. Each read is audited like a call, with its
  redactions and injection events. Reads and prompts count toward the
  agent's rate limit (as every read and prompt does) and its bytes
  budget: one bucket per agent for resource reads and one for prompts,
  with `output.bytes_budget_default`. A result larger than what is left
  is cut with the byte budget notice (joined to the output budget's, at
  the end of the last item); a spent bucket refuses the request with
  `RATE_LIMITED` (-31001, "Byte budget exhausted for resource reads;
  retry after <time>", `retryAfterMs` in `data`) before it reaches the
  upstream. A URI or prompt no upstream serves is not charged. Prompt
  arguments pass through input sanitization before the upstream gets
  them, as tool arguments do, with the global
  `sanitization.input_credentials` (default `block`) and `input_pii`
  (default `audit`): a blocked request is answered -32602 "Arguments
  contain a credential (<rule>); call blocked.", `redact` sends
  placeholders, and the audit record keeps the sanitized copy and the
  HMAC. Not covered: pinning prompt and resource definitions.
- `env`, `headers` and credential values are secrets: redacted from
  results, scrubbed from every error and log line (the child's stderr
  included), absent from the audit trail, and masked by `config show`
  (a `${VAR}` reference is shown as written, never expanded).
- Protocol: the initialize handshake, revisions 2025-11-25, 2025-06-18,
  2025-03-26 and 2024-11-05. Sievant declares no client capabilities; it
  answers ping and refuses sampling, elicitation and roots requests.
- `` is expanded in `env` and `headers` values (map values elsewhere
  in the file are not expanded, as in v0.1.0).

`sievant proxy` serves one upstream with no configuration file, for
local use: one agent, every tool allowed, the default redaction rules, 50
calls/s, and the audit store and a generated HMAC key in the per-user
state directory (`$XDG_STATE_HOME/sievant`, `~/.local/state/sievant`,
`%LOCALAPPDATA%\sievant`):

```sh
sievant proxy --env API_TOKEN=$TOKEN -- npx -y @example/server-files@1.2.3 /srv/docs
sievant proxy --url http://localhost:3000/mcp --header "Authorization: Bearer $TOKEN"
sievant proxy --list-tools -- uvx mcp-server-example   # tools, sha256 pins, served or withheld
```

What it adds to a tool call: p99 **0.24 ms** over calling the server
directly (`TestProxyOverheadBudget`, gate 2 ms).
