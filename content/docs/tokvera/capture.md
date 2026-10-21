---
title: "`tokvera capture` — record a usage log from live traffic"
source:
  repo: tokvera
  path: docs/capture.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 8
---

A client that has no OpenTelemetry instrumentation can still give an audit
something to read: run `tokvera capture` in front of the model API, point the
application at it, and it writes one usage-log line per call in the format
`tokvera audit` already reads (`docs/usage-log-format.md`).

It is a small reverse proxy for **OpenAI-compatible chat completions**
(`POST /v1/chat/completions`, also `/chat/completions`). Every other path is
answered 404 and never forwarded. The Anthropic Messages API is not supported.

## What it records

One JSON line per call, appended to `--out`:

- when the call started, its duration, and for a stream the time to the first
  content chunk (`ttft_ms`);
- the service and provider you name, the model the provider answered with, and
  the finish reason;
- the provider's own token counts (`input_tokens`, `output_tokens`, cached
  reads and writes) when the response carried them. For a stream the proxy asks
  for them (`stream_options.include_usage`);
- `prompt_hash` (the audit's cache key of the whole request), `loop_fingerprint`
  (the audit's loop key of the latest user turn) and `tool_results_hash`, so the
  audit can find cache opportunities and runaway agent loops;
- the session id from the optional `x-tokvera-session` request header;
- for a call that failed, its `http_status` and an `error_class`.

When a call's usage is unknown (a stream that sent no usage object, a failed or
redirected call) the line carries **no** token fields at all, never `0`. The
audit counts such a call, keeps it out of every token and cost figure, and
states the coverage in the report ("Token usage: reported on N of M usage-log
calls").

## What it never records

- **Prompt or completion text.** The request is reduced to the three hashes
  above before anything is written. No text reaches the log, stdout, stderr or
  any error message.
- **Credentials.** `Authorization` and `x-api-key` are forwarded to the upstream
  so the call works, and are never written anywhere. `Proxy-Authorization` (your
  own proxy's credentials) is not forwarded to the provider at all.
- Anything a `x-tokvera-*` header carries other than a valid session id. Those
  headers are the proxy's own and are never forwarded.

The log is created with mode 0600 and only ever appended to, one complete line
per call.

## Running it

```sh
./bin/tokvera capture \
  --upstream https://api.openai.com/v1 \
  --service support-bot \
  --out data/usage/support-bot.jsonl
```

```
tokvera capture listening on 127.0.0.1:8787, forwarding to api.openai.com, logging to data/usage/support-bot.jsonl
```

| flag | default | meaning |
| --- | --- | --- |
| `--listen` | `127.0.0.1:8787` | listen address; a non-loopback address is refused unless `--allow-remote-bind` |
| `--upstream` | (required) | the provider's OpenAI-compatible base URL; plain `http` is refused unless the host is loopback |
| `--out` | (required) | the usage JSONL file |
| `--service` | (required) | written on every line; the audit groups findings by it |
| `--provider` | `openai` | written on every line; must match the provider key in the audit's `pricing.yaml` |
| `--max-concurrent` | `64` | in-flight call limit; past it a call gets `503` |
| `--header-timeout` | `60s` | how long to wait for the upstream's response headers; there is no total timeout, so long streams run. Raise it for a local model that loads cold (below) |
| `--allow-remote-bind` | off | allow a non-loopback `--listen` |

A local model that loads cold (multi-GB weights read into memory or VRAM on
first request, as Ollama does by default) sends no response headers until the
load finishes. With the default `--header-timeout 60s` that first call fails as
a `timeout` and is logged without tokens; raise the flag, e.g.
`--header-timeout 5m`. The first call that does succeed still carries the load
in its `ttft_ms`, and the audit names a slow first call followed by fast ones
as a likely cold start rather than a capacity problem.

Stop it with Ctrl-C (SIGINT) or SIGTERM. It stops accepting calls, lets the
ones in flight finish (up to 30 seconds), closes the log and prints a summary
of counts only:

```
tokvera capture: 1204 calls logged, 1190 with usage, 9 failed
```

Exit codes follow the rest of the CLI: `2` for invalid flags (every problem is
listed at once), `1` when `--out` cannot be opened or the address cannot be
bound, `0` after a clean stop.

## Pointing an application at it

Set the application's OpenAI base URL to the proxy, including `/v1`:
`http://127.0.0.1:8787/v1`. The API key stays the application's own; the proxy
passes it through.

Both official OpenAI SDKs read the base URL from `OPENAI_BASE_URL` when the
code does not pass one (openai-python `_client.py`:
`base_url = os.environ.get("OPENAI_BASE_URL")`; openai-node `client.ts`:
`baseURL = ... readEnv('OPENAI_BASE_URL')`), so often no code change is
needed:

```sh
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
python app.py
```

An application that reads its own variable works the same way. For example,
an app that builds its client from `LLM_BASE_URL`, with a session id per
conversation through `extra_headers` (an argument every openai-python request
method takes):

```python
import os
from openai import OpenAI

client = OpenAI(base_url=os.environ["LLM_BASE_URL"])  # http://127.0.0.1:8787/v1

def answer(conversation_id: str, messages: list[dict]) -> str:
    resp = client.chat.completions.create(
        model=os.environ["LLM_MODEL"],
        messages=messages,
        extra_headers={"x-tokvera-session": conversation_id},
    )
    return resp.choices[0].message.content
```

```sh
LLM_BASE_URL=http://127.0.0.1:8787/v1 LLM_MODEL=<your model> python app.py
```

The session header is optional. With it, the audit groups calls by
conversation, which is what runaway-loop detection needs. A value that is not 1
to 128 bytes of printable ASCII is dropped and the call proceeds without one.

## Feeding the log to the audit

Name the file in `inputs.usage_logs` (the counts are inclusive, OpenAI's own
convention and the default `token_semantics`):

```yaml
inputs:
  usage_logs: ["data/usage/support-bot.jsonl"]
```

then run the audit as usual:

```sh
./bin/tokvera audit --config audit.yaml
```

The report's methodology section states how many of the captured calls reported
token usage, and how many failed.
