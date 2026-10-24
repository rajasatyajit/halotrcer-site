---
title: Roadmap
source:
  repo: tokvera
  path: docs/roadmap.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 18
---

What is planned but not in this release. Nothing here works yet, and none of
it has a date. If one of these matters to you, say so: it helps decide the
order.

## Scan

- **Suite themes.** Today a suite sets only the size of the load (`quick`,
  `standard`, `deep`). Themes would pick what it exercises, for example long
  prompts or long outputs.
- **Embedding-based cache potential.** The cache check counts exact repeats
  in `--prompts` today. Counting near-repeats needs an embedding model; it
  will be opt-in, use a local endpoint by default (Ollama or any
  OpenAI-compatible endpoint you name), and send your prompts elsewhere only
  if you point it at a remote endpoint yourself. The audit already does this
  ([audit.md](audit.md)).
- **Targets suggested from your repository.** Today the scan suggests
  targets from environment variables. It will also read endpoint URLs from
  files in the current repository. Like today's suggestions, they will be
  shown and confirmed, never used on their own, and with `--yes` only an
  explicit `--target` is scanned.
- **`scan --k8s`.** Run the scan as a short-lived Job in the current
  Kubernetes context, copy the report back and delete the Job, only when the
  flag is passed. Until then, the Helm chart runs scheduled scans in a
  cluster ([helm.md](helm.md)).

## Release

- **An air-gapped bundle** with every release file in one download, and an
  offline `tokvera verify` that checks it without contacting anything. Until
  then, [install.md](install.md) shows how to verify a release by hand on a
  host without GitHub access.

## Scoring

- **Scoring 1.0.0.** The grade is provisional (0.9.0) until its thresholds
  have been calibrated against real pilot scans ([scoring.md](scoring.md)).
