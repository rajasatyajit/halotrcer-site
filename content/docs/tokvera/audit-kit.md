---
title: The audit kit commands
source:
  repo: tokvera
  path: docs/audit-kit.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 11
---

The commands a consultant uses around an audit (SPEC v0.2 milestone 3). Each
works offline unless its section says otherwise.

## `tokvera instrument`

```sh
tokvera instrument --lang go|python|node [--dir DIR] [--name NAME]
```

- **What it writes:** OpenTelemetry GenAI instrumentation for one language,
  the same code an audit ships in its fix pack (`otel-instrumentation-go`,
  `-python`, `-typescript`; `node` is the JavaScript/TypeScript ES-module
  one). It emits spans and metrics under the GenAI semantic conventions, and
  each language comes with its own tests.
- **Where:** `--dir`, default `tokvera-instrument-LANG`.
  - A directory that exists and is not empty is refused (exit 1) and left
    untouched. An empty one is used.
  - The files are rendered and checked (parse, gofmt, the metrics catalog) in
    a staging directory beside the target, then moved in with one rename, so a
    failure leaves nothing behind.
- **`--name`:** written into the file headers only. It is limited to letters,
  digits, spaces and `. _ - : /`, at most 120 characters, so it reads the same
  in a Go, Python and JavaScript comment.
- **Start with** `README.md` in the directory.

## `tokvera audit report --client`

```sh
tokvera audit report --bundle out/acme-2026-10 --client "Acme, Inc." [--out FILE]
```

- **What it writes:** the bundle's `report.md`, the text the client was
  delivered, as one branded HTML page. It is rendered by the same Markdown
  renderer as `report.html`, so the body is identical. In front of it sits a
  cover with the client's name, the audit id and date, and "Prepared by
  Halotrcer" as a text wordmark, with the contact address and booking link
  as plain text.
- **No images, no links:** the page fetches nothing, like `report.html`. Print
  it to PDF from a browser; the cover breaks to its own page. PDF output
  itself is a SPEC non-goal.
- **Where:** `--out`, default beside the bundle as
  `<audit_id>-<client>.html`. The bundle is not modified.
- **`--client`:** 1-120 characters, no control characters. When it is not the
  name in the report's own heading (`target.client` in audit.yaml), the
  command says so on stderr. The cover and the body then name different
  things, which may be intended (an internal codename in the audit).

## `tokvera stack up|down`

```sh
tokvera stack up [--dir DIR] [--fixpack out/acme-2026-10/fixpack]
tokvera stack down [--dir DIR] [--volumes]
```

- **What it runs:** the observability stack of deploy/observability/README.md
  (the OpenTelemetry Collector, Prometheus, Grafana), from files embedded in
  the binary, so no checkout is needed. It needs Docker with the compose
  plugin, run as an external program. Without it the command says how to
  install it.
- **Where its files go:** `--dir`, default the data directory
  (`~/.local/share/tokvera/stack`, or `$XDG_DATA_HOME/tokvera/stack`, or
  `%LOCALAPPDATA%\tokvera\stack`).
  - Every `up` rewrites the managed files, so a newer tokvera brings its newer
    rules and dashboard.
  - `client-targets/` is written once and then left alone: you edit it to
    point Prometheus at your own `/metrics`.
- **`--fixpack`:** an audit bundle's `fixpack/` directory. The stack then runs
  that audit's collector config, alert rules and dashboard instead of the
  reference ones. A fix pack missing one of the three is refused before
  anything starts.
- **Ports:** every port binds to 127.0.0.1.
  - Grafana `:3000`, Prometheus `:9090`, OTLP `:4318` (HTTP) and `:4317`
    (gRPC).
  - Grafana's admin password is the local default unless
    `TOKVERA_GRAFANA_ADMIN_PASSWORD` is set, and `up` warns about it.
- **Stopping it:** `stack down` keeps the files; `--volumes` also deletes the
  stored metrics and Grafana state.

## `tokvera stack helm-values`

```sh
tokvera stack helm-values [--out DIR] [--namespace NS] [--fixpack out/acme-2026-10/fixpack]
```

- **What it writes:** two values files, in `--out` (default
  `tokvera-helm-values`). They put the same stack into a Kubernetes cluster
  through the upstream charts, at the versions the command prints. It sends
  nothing to a cluster.
- **`opentelemetry-collector.values.yaml`**, for
  `oci://ghcr.io/open-telemetry/opentelemetry-helm-charts/opentelemetry-collector`:
  - the fix pack's collector config, verbatim (`alternateConfig`, so none of
    the chart's default Jaeger, Zipkin or debug pipelines are merged in);
  - the image the compose stack pins, by digest;
  - the Prometheus exporter port 8889 on the Service;
  - an emptyDir for the trace file;
  - resource limits;
  - the Service is named `tokvera-otel-collector`, whatever the release is
    called.
- **`kube-prometheus-stack.values.yaml`**, for
  `oci://ghcr.io/prometheus-community/charts/kube-prometheus-stack`:
  - the alert and recording rules as a PrometheusRule;
  - a scrape job for `tokvera-otel-collector.<namespace>.svc:8889`;
  - the dashboard, in a "Tokvera" folder.
- **`--namespace`:** both charts go into it (default `monitoring`); the
  scrape target names the collector's Service there.
- **`--fixpack`:** as for `stack up`, an audit's own rendered artifacts.
- **Checked against the pinned versions:** every key was read from the
  charts' own `values.yaml`, and `make integration` renders both charts with
  the generated values (`helm template`). Before using a newer chart version,
  re-run that check.

## `tokvera cache`

```sh
tokvera cache serve --upstream https://api.openai.com/v1 [--match exact|similar] [--store memory|redis]
```

A caching reverse proxy for OpenAI-compatible chat completions. Point the
client's base URL at it (default `http://127.0.0.1:8788`). It answers a
repeated request from the cache and forwards everything else unchanged.

- **What it is:** a separate program, `tokvera-cache`, with its own Go module
  (`cmd/tokvera-cache`; it links the Redis client, which tokvera itself does
  not).
  - **Where it ships:** its own release archive
    (`tokvera-cache_<version>_<os>_<arch>`), and inside the deb, rpm and apk
    packages beside `tokvera`.
  - **Where `tokvera cache` finds it:** beside its own executable, then on
    PATH. Without it the command says where to get it.
- **What is cached:** the same rules as the fix pack's semantic cache.
  - Only `POST …/chat/completions` with one choice.
  - Only at or below `--max-temperature` (default 0.2). A request without a
    temperature runs at the provider default, 1, so it is not cached unless
    the limit allows it.
  - Only a 200 answer that finished normally: not truncated (the audit's own
    truncation spellings, `length` `max_tokens` `model_length` `truncated`,
    in any case), with no tool call, and for a stream, one that reached
    `[DONE]`.
  - A streamed answer is stored whole and replayed byte for byte to the next
    identical streamed request.
- **Answers never cross API keys:** the namespace is a digest of the
  `Authorization`, `X-Api-Key` and `Api-Key` headers.
- **`--match exact` (the default)** answers only an identical request: the
  same JSON, whatever its key order and spacing.
- **`--match similar`** compares the last user turn by embedding similarity
  (`--threshold`, default 0.95) among requests that are otherwise identical,
  the system prompt, tools and parameters included.
  - **It can replay a wrong answer** for a prompt that is close but not the
    same. Measure it before you rely on it.
  - **The prompt text leaves the process:** it is sent to `--embed-url` (an
    OpenAI-compatible `/embeddings`, e.g. Ollama's). That endpoint must be on
    this machine or a private network unless `--allow-remote-embedding` is
    passed.
- **Storage:** `--store memory` (bounded by `--max-entries`, gone on exit), or
  `--store redis --redis-url redis://…`, shared by every proxy that points
  at it.
- **Per request:** `X-Tokvera-Cache: bypass` (or `Cache-Control: no-cache`)
  skips the cache, and every answer carries `X-Tokvera-Cache: hit`, `miss`
  or `bypass`.
- **Metrics:** `/tokvera-cache/metrics` exposes
  `tokvera_semcache_hits_total{service_name}` and
  `tokvera_semcache_misses_total{service_name,tokvera_reason}`, the fix
  pack's names. The pack's cache-hit-ratio rule and dashboard panel read it
  as they read the library.
- **Listening:** loopback only, unless `--allow-remote-bind`, since the proxy
  has no authentication of its own.
