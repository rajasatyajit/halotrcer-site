---
title: Traces and audit export
source:
  repo: sievant
  path: docs/telemetry.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: true
order: 9
---

Sievant keeps its audit trail in a local store. It can also send it
elsewhere: audit records to a SIEM, and one trace per request to an
OpenTelemetry collector. Both are off unless configured; with neither, no
work is added to a call.

Both hang off the audit trail: each record the store receives is copied
into a bounded queue and sent by a background worker. A slow or absent
collector never slows a call. When a queue is full, records are dropped
and counted, as `sievant_audit_export_records_total{sink,outcome}`
(outcomes `sent`, `dropped`, `failed`).

## Audit export

```yaml
audit:
  sink: local
  local: {path: /var/lib/sievant/audit.db}
  export:
    - type: otlp                     # OTLP/HTTP logs, JSON encoding
      endpoint: https://otel-collector:4318/v1/logs
      headers: {Authorization: "Bearer ${OTLP_TOKEN}"}
    - type: syslog                   # RFC 5424
      address: siem.example.com:6514
      network: tls                   # tls (default, RFC 5425) | tcp (RFC 6587 octet counting) | udp
    - type: webhook                  # HTTPS POST, batched, signed
      endpoint: https://siem.example.com/ingest/sievant
      hmac_key: ${SIEVANT_EXPORT_KEY}  # at least 32 characters
      records: all                   # security (default) | all
```

- **records**: `security` (the default) sends security events and their
  flood summaries; `all` sends every record, calls included.
- Each record is the audit store's row without the sanitized input, the
  input HMAC or the trace spans, as JSON with `"schema":
  "sievant.audit.v1"`. Fields are only ever added.
- Flood summaries are exported like the store keeps them: one record whose
  `event_count` covers the window.
- **otlp**: one log record per audit record, the JSON as its body,
  severity `WARN` for refused requests and `INFO` otherwise, the trace ID
  set; resource `service.name=sievant`.
- **syslog**: facility local0; severity warning for a refused request,
  notice for another security event, info for a call; MSGID the event kind
  (or `CALL`); the JSON as the message.
- **webhook**: `{"schema": "sievant.audit.v1", "records": [...]}`, with
  `X-Sievant-Timestamp` (Unix seconds) and `X-Sievant-Signature:
  sha256=<hex HMAC-SHA256 of "<timestamp>.<body>">`. Check the signature
  in constant time and refuse old timestamps.
- `https://` unless `plaintext: true`; `ca_file` adds a CA; header values
  and the HMAC key are masked in `sievant config show`.
- Delivery: batches of `batch_size` (default 256) or every
  `flush_interval` (default 2s), from a queue of `queue_size` (default
  4096); a failed batch is retried twice, a 4xx answer (other than 408 and
  429) is not retried. On shutdown the queue is sent first, for at most
  10 seconds.

## Traces

```yaml
telemetry:
  traces:
    endpoint: https://otel-collector:4318   # traces go to <endpoint>/v1/traces
    sample_ratio: 0.1                       # default 1
    headers: {Authorization: "Bearer ${OTLP_TOKEN}"}
```

One trace per tool, prompt or resource request: a span for the request,
named after its kind and target (`tool search_docs`), and one child span
per guardrail stage (`identity`, `rbac`, `ratelimit`, `sanitize_in`,
`injection`, `backend`, `sanitize_out`, ...), timed from the audit
record. The trace ID is the audit record's, so a trace and its audit
records are found by the same ID; when the caller sent a sampled W3C
`traceparent`, the request span is its child. Sampling is parent-based,
with `sample_ratio` for traces the caller did not sample.
