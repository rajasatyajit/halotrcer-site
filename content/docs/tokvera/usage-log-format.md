---
title: Tokvera usage-log format (v1)
source:
  repo: tokvera
  path: docs/usage-log-format.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 9
---

A line-delimited JSON file (`.jsonl`) that lets clients without OpenTelemetry
export LLM call data from their own logs. Each line is one call — one JSON
object, no nesting beyond it. Unknown fields are rejected (strict decoding);
blank lines are skipped. Every bad line is reported by file and line number.

```json
{"ts":"2026-10-01T08:00:00.123Z","service":"support-bot","session_id":"sess-01","provider":"openai","model":"acme-lite","input_tokens":500,"output_tokens":180,"cached_input_tokens":0,"cached_write_input_tokens":0,"finish_reason":"stop","prompt":"optional raw text","prompt_hash":"optional 64-hex","tool_results_hash":"optional 64-hex","ttft_ms":0,"duration_ms":0}
```

## Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `ts` | yes | RFC 3339(+Nano) call start time; keep the client's offset — Tokvera converts to UTC |
| `service` | yes | logical service making the call |
| `session_id` | no | conversation/session scope (runaway-loop detection is session-scoped) |
| `provider` | yes | `openai`, `anthropic`, … — must match the pricing table key |
| `model` | yes | exact model ID as served — must match the pricing table key |
| `input_tokens` | see below | billed prompt tokens — see **Two ways to count a cached prompt** below |
| `output_tokens` | see below | billed completion tokens |
| `cached_input_tokens` | no | prompt tokens served from a provider-side cache |
| `cached_write_input_tokens` | no | prompt tokens WRITTEN to a provider-side cache by this call |
| `finish_reason` | no | `stop`, `length`, … — `length`/equivalents mean truncated (matched case-insensitively). Empty or absent: the call stays out of the truncation ratio |
| `prompt` | no | **optional raw text.** See privacy handling below |
| `prompt_hash` | no | 64-hex SHA-256 of the normalized prompt; if `prompt` is also present the computed hash wins |
| `loop_fingerprint` | no | 64-hex loop key computed by the writer. When present it is used as the loop key instead of the one derived from `prompt` or `prompt_hash`. The capture proxy writes `ingest.LoopFingerprint` of the latest user turn |
| `tool_results_hash` | no | 64-hex over the tool results attached to this call — lets loop detection distinguish "same prompt, world unchanged" from "same prompt, world changed" |
| `stream` | no | boolean; `true` if the call used streaming (SSE). Non-streamed calls omit it or write `false` |
| `max_tokens` | no | numeric configured output limit (`max_tokens` or `max_completion_tokens`) from the request; lets `max_tokens_exhaustion` distinguish the configured limit from the model limit |
| `ttft_ms` | no | time-to-first-token, milliseconds (0 = unknown) |
| `duration_ms` | no | total call duration, milliseconds |
| `http_status` | no | upstream HTTP status of a call that did not succeed (absent on a success) |
| `error_class` | no | short class for a call that did not succeed (the capture proxy writes `upstream_status`, `redirect_refused`, `transport`, `timeout`, `stream_interrupted`, `client_disconnected`). A line with an `error_class` or a non-2xx `http_status` is a failed call |

### A call whose usage is unknown

A line may carry **none** of the four token counts (`input_tokens`,
`output_tokens`, `cached_input_tokens`, `cached_write_input_tokens`). That
states "this call happened and its usage is unknown": a stream that sent no
usage object, a failed or redirected call. Never write `0` for an unknown
count — `0` is a measurement. Such a line counts as a call (call counts,
latency, loop detection), is never priced, is left out of every token and cost
sum, and the report's methodology section states the usage coverage ("Token
usage: reported on N of M usage-log calls"). A line with at least one count
parses exactly as before: an absent sibling count is `0`.

## Two ways to count a cached prompt

Whether the cached tokens sit **inside** `input_tokens` or **beside** it is not a
format detail — it is the difference between billing a call at its real size and
billing it twice. It is a property of who wrote the log, so the audit declares it
per input:

```yaml
inputs:
  usage_logs:
    - data/usage/*.jsonl                # inclusive, the default
    - path: data/claude/*.jsonl
      token_semantics: exclusive        # cached tokens sit outside input_tokens
```

**`inclusive`** (the default, and the OpenTelemetry GenAI convention):
`input_tokens` is the whole prompt. `cached_input_tokens` and
`cached_write_input_tokens` are counts *within* it. `inputs.traces[]` takes the
same option, and inclusive is right there too: a Collector GenAI export follows
the same convention.

**`exclusive`** (how the Anthropic Messages API reports usage): `input_tokens` is
only what came after the last cache breakpoint, and both cached counts are
reported outside it. Tokvera then computes
`input = input + cache_read + cache_write` at the read — before the record is
validated, priced, sampled or counted anywhere — so every figure in the bundle
means one convention whatever the file said.

The same call, 12,050 prompt tokens of which 10,000 were read from cache and
2,000 written into it, 200 tokens out:

```json
{"ts":"2026-10-01T08:00:00Z","service":"claude-proxy","provider":"anthropic","model":"…","input_tokens":12050,"output_tokens":200,"cached_input_tokens":10000,"cached_write_input_tokens":2000,"finish_reason":"stop"}
{"ts":"2026-10-01T08:00:00Z","service":"claude-proxy","provider":"anthropic","model":"…","input_tokens":50,"output_tokens":200,"cached_input_tokens":10000,"cached_write_input_tokens":2000,"finish_reason":"stop"}
```

The first line is inclusive (the default reading); the second is the Anthropic
shape and needs `token_semantics: exclusive`. Under that setting both describe a
12,050-token call and price identically — 2,050 tokens at the input rate, 10,000 at
the cached-input rate and 200 at the output rate, on a sheet that carries no
cache-write rate (see below for what changes when it does). Read the second line as
inclusive and it is refused instead — 10,000 cached tokens cannot fit inside 50
input tokens.

The names here follow the OpenTelemetry pair (`cache_read` / `cache_write`), not
the provider's: an Anthropic export's `cache_read_input_tokens` is
`cached_input_tokens` and its `cache_creation_input_tokens` is
`cached_write_input_tokens`. On the trace side the same quantities are
`gen_ai.usage.cache_read.input_tokens` and `gen_ai.usage.cache_write.input_tokens`
(`ingest.GenAIMapping`), and `inputs.traces[].token_semantics` applies the same
rule to them.

**Tokvera never guesses which convention a file uses.** A cached count *below*
input fits both readings, so guessing would silently rewrite a client's bill one
way or the other; and a wrong guess in the flattering direction (reading
inclusive data as exclusive) inflates every prompt and double-counts the cached
tokens. Declare it, or leave the default.

The two wrong declarations fail differently, and one of them is the dangerous
one:

- `exclusive` on inclusive data inflates every prompt (the cached tokens count
  twice) and raises every cost figure. Nothing looks broken: the audit simply
  over-bills, quietly.
- `inclusive` on exclusive data refuses the Anthropic-shaped records. This one is
  loud — the exclusion is counted and located in the bundle, and the refusal
  names the setting to change.

### Cache writes need their own rate, or the figure is a floor

`input_tokens` is the whole prompt, so a token written into a cache is inside it
and has to be priced somewhere. `pricing.yaml` prices it with the optional
per-model key:

```yaml
models:
  - provider: anthropic
    model: "<id>"
    input_per_mtok: 3.0
    output_per_mtok: 15.0
    cached_input_per_mtok: 0.3
    cache_write_input_per_mtok: 3.75   # optional
```

- **Rate present:** writes are billed at it, and reads at `cached_input_per_mtok`.
- **Rate absent:** writes fall back to `input_per_mtok`, and the bundle says the
  resulting cost is a **lower bound** — in the report's methodology section, in
  review notes and as a decision on `DELIVERY-CHECKLIST.md`. It matters because
  Anthropic prices a cache write *above* a fresh read (25 % more for a 5-minute
  cache, 2× for a 1-hour cache), so a figure built from the input rate is short of
  what that client actually pays. The multiplier is never guessed: a stated floor
  is auditable, an invented rate is not.
- **A stated `0.0`** is a rate like any other — free writes, on the provider's own
  word — and raises no disclosure. Absent and zero are different facts.

Because a cache write is part of the prompt, `pricing.ValidateTokenCounts` refuses
a record whose reads and writes *together* exceed its `input_tokens`: the
remainder is what the uncached rate multiplies, so letting the parts outgrow the
whole would price a negative number of tokens.

## Token counts that cannot be true

A line with `input_tokens: -5`, or with `cached_input_tokens` larger than its
own `input_tokens`, or with a count no model can produce (> 2^40), is not
repaired and not fatal. The record is **excluded from every figure** — no count,
no cost, no percentile — and the audit reports it: how many, under which reason,
and where to find them (file and line). `pricing.Cost` refuses such a record
rather than clamping it, because a clamped negative bills tokens that never
happened and a clamped over-count edits the client's own log; either way the
report shows a number the client cannot find in their data.

One refusal carries a diagnosis with it. When `cached_input_tokens` exceeds
`input_tokens` on a record whose provider is `anthropic`, the reason the bundle
prints ends with: **"Anthropic reports input exclusive of cache; set
token_semantics: exclusive"** — in the client report's methodology section, in
review notes, and as a decision in `DELIVERY-CHECKLIST.md`. It is the most common
way to meet this refusal, and the fix is one line of config rather than a
re-export. It is also advice only: the record stays excluded until the input
declares its convention and the audit is re-run, because Tokvera does not
reinterpret a client's numbers on a hunch. The hint names Anthropic because
Anthropic is the provider that documents the convention; any other provider with
the same counts is a broken exporter, and an input that already declared
`exclusive` is told nothing about declaring it.

A line that does not parse as usage-log JSON, that omits `service`, `provider`,
or `model`, or whose `ts` is not RFC 3339, is one refused record: counted by
reason, located by file and line, and left out of every figure. The rest of the
file is read. A line longer than 16MB is the same kind of refusal (`line_too_long`);
reading continues at the next newline and those bytes are not kept. The refusal
stores the reason and the location, not the line. Opening a file that cannot be
read is still a failure of the whole audit.

## Privacy handling of `prompt`

Raw prompt text **never leaves the machine and never lands in output**:

1. During ingest it is normalized (volatile tokens stripped), then hashed
   (SHA-256 hex) to a fingerprint.
2. The text itself is kept only in process memory, in an unexported field,
   solely for optional local embedding (M4).
3. The pipeline calls `Result.DropPrompts()` as soon as embedding is done.
4. No findings document, report, log line, or error message can contain it:
   the field is not marshalable, `Event.String()` is redacted by construction,
   and decode errors are sanitized (Go's type-error text embeds the offending
   literal, so it is rebuilt without the value). The end-to-end test greps
   the whole bundle for a canary planted in simulated prompts.

## Two keying regimes (canonical, owned by `pkg/ingest`)

Hashes are computed from the raw prompt under TWO independent regimes:

**Cache key** (`prompt_hash`): the EXACT text with whitespace collapsed to
single spaces and trimmed. Nothing else is stripped — `invoice 48213` and
`invoice 48214` are different cache keys, because serving one from the
other's answer would be a wrong answer, not a hit.

**Loop fingerprint** (computed internally, unless the line carries
`loop_fingerprint`): structural
volatility only — ISO-8601 timestamps, UUIDs, and 10/13-digit epoch
timestamps are replaced by placeholders, then whitespace collapses. Generic
digit runs are **not** stripped by default; operators whose app puts volatile
numbers in prompts opt in via `detectors.runaway_loop.volatile_patterns`
(regexes applied only to the loop key).

So byte-distinct prompts that differ only in layout share one cache key, and
semantically identical prompts that embed a changing number share one loop
fingerprint **only** after an explicit operator opt-in.

Detectors group loops by `(session, loop fingerprint, tool_results_hash)` and
cache duplicates by `(cache key)`; when only `prompt_hash` is supplied (no
raw prompt and no `loop_fingerprint`), the loop key degrades to the cache key
value.

## Relation to OTLP traces

Everything here has a trace-side equivalent (`gen_ai.conversation.id` =
`session_id`, `gen_ai.usage.*` = token fields, `gen_ai.response.finish_reasons`
= `finish_reason`, `gen_ai.response.time_to_first_chunk` = `ttft_ms`).
Ingest merges both sources into one event list; a client may supply either,
both, or neither (missing sources are disclosed in coverage).
