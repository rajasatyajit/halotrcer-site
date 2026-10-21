---
title: "Helm chart: a scheduled scan"
source:
  repo: tokvera
  path: docs/helm.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: false
order: 7
---

`deploy/helm/tokvera` runs `tokvera scan` on a schedule against one inference
endpoint inside the cluster. It keeps the latest `report.json` and
`report.html` and can fail the run when the endpoint regresses against a
baseline report.

```sh
helm install scan oci://ghcr.io/rajasatyajit/charts/tokvera --version 0.2.0 \
  --namespace inference \
  --set scan.confirm=true \
  --set scan.target=http://vllm.inference.svc.cluster.local:8000/v1 \
  --set scan.model=my-model
```

- **Where the chart is published:** only by the release workflow, in its
  publish phase, after the owner publishes a tagged release
  (docs/releasing.md). Nothing is pushed before a tag.
- **Version and image:** the chart's version is the release's version. Its
  default image is that release's `ghcr.io/rajasatyajit/tokvera`, pinned by
  digest.
- **Before the first release:** install from a checkout with
  `helm install scan deploy/helm/tokvera …`.

## What runs

One CronJob (default schedule `17 3 * * *`). Each run is one pod with two
containers, both the tokvera image:

1. `scan` (an init container) runs:

   ```sh
   tokvera scan --target <scan.target> --suite <scan.suite> --yes --no-cta \
     --out /reports/latest
   ```

   It writes `report.json` and `report.html` to the reports volume, replacing
   the previous run's.
2. `summary` runs `tokvera scan summary --report /reports/latest/report.json
   --format text`. It prints the grade and the top findings to its log.
   - **With a baseline:** it compares the run with the baseline and exits 1 on
     a regression. The Job then fails.

The image has no shell, so the two steps are two containers rather than a
script. To start a run now and read its result:

```sh
kubectl -n inference create job --from=cronjob/scan-tokvera scan-now
kubectl -n inference logs job/scan-now -c summary
```

## Consent: `scan.confirm`

Every run sends load to the target. The chart renders nothing until
`scan.confirm=true`, which passes `--yes` to the scan (the scan's own consent
prompt cannot be answered in a CronJob). Read the plan first, from any
machine that can reach the target:

```sh
tokvera scan --target <url> --model <model> --dry-run
```

The suite's hard caps apply on every run. `scan.maxRequests`, `scan.maxCost`
and `scan.rate` lower them further.

## Values

`values.schema.json` checks every value at install time, and an unknown key
is an error, not a silent no-op.

| Value | Default | Meaning |
|---|---|---|
| `scan.confirm` | `false` | Required: allow the CronJob to send load. |
| `scan.target` | `""` | Required: the endpoint's base URL (`http(s)://…`). |
| `scan.model` | `""` | The model to scan. Required when the endpoint lists more than one. |
| `scan.kind` | `""` | `openai_compatible` or `anthropic`; empty infers it from the host. |
| `scan.suite` | `quick` | `quick`, `standard` or `deep`. |
| `scan.maxRequests`, `scan.maxCost`, `scan.rate` | `0` | Lower caps; 0 keeps the suite's own. |
| `scan.requestTimeout` | `60s` | Per request. |
| `scan.readMetrics` | `true` | Read the target's `/metrics` during the load. |
| `scan.failUnder` | `""` | Fail the run below this grade (`A`–`F`; there is no `E`). |
| `scan.apiKey.existingSecret`, `.key` | `""`, `api-key` | The key, from a Secret you create; never a value. |
| `scan.extraArgs` | `[]` | More `tokvera scan` flags. |
| `schedule`, `timeZone` | `17 3 * * *`, `""` | When to run. |
| `concurrencyPolicy` | `Forbid` | A run never overlaps the previous one. |
| `backoffLimit` | `0` | A failed run is not retried (a retry would send the load again). |
| `activeDeadlineSeconds` | `1800` | The whole run's limit. |
| `baseline.existingConfigMap`, `.key` | `""`, `report.json` | The baseline report (below). |
| `baseline.maxLatencyRegressionPct` | `20` | A p95 latency regresses past this rise… |
| `baseline.minLatencyDeltaMs` | `50` | …and at least this many milliseconds. |
| `baseline.maxCostRegressionPct` | `10` | Cost per 1,000 requests. |
| `persistence.enabled` | `true` | Keep the reports on a claim. |
| `persistence.existingClaim`, `.storageClass`, `.size` | `""`, `""`, `64Mi` | |
| `alerts.prometheusRule.enabled` | `false` | The run-failed alert (below). |
| `image.digest` | the release's | Pin another image by digest; used instead of `image.tag`. |
| `resources` | 50m/64Mi requests, 500m/256Mi limits | Limits are required by the schema. |

## Where the reports are kept

- **The claim:** with `persistence.enabled` (the default), the reports live
  on a PersistentVolumeClaim, `<release>-tokvera-reports`, under `latest/`.
  - The claim carries `helm.sh/resource-policy: keep`, so the reports outlive
    `helm uninstall`. Delete the claim by hand when you are done.
  - With `persistence.enabled=false`, an emptyDir holds the reports for the
    run only. The grade still reaches the log.
- **Why not a ConfigMap:** writing one needs the Kubernetes API from inside
  the pod, which means a service-account token and RBAC to change
  ConfigMaps. The scan otherwise never talks to the API server, so the pod
  mounts no token at all. A ConfigMap is also capped at 1 MiB, while a
  report is just files.
- **Reading the reports:** the tokvera image has no shell (and so no
  `kubectl cp`). Read them from any pod that mounts the claim read-only:

  ```sh
  kubectl -n inference run reports --rm -i --restart=Never --image=alpine:3.22 \
    --overrides='{"spec":{"containers":[{"name":"reports","image":"alpine:3.22","stdin":true,
      "command":["cat","/r/latest/report.html"],
      "volumeMounts":[{"name":"r","mountPath":"/r","readOnly":true}]}],
      "volumes":[{"name":"r","persistentVolumeClaim":{"claimName":"scan-tokvera-reports","readOnly":true}}]}}' \
    > report.html
  ```

- **A storage class that binds on first use:** with a WaitForFirstConsumer
  class (kind's, GKE's `standard-rwo`, most EBS classes), the claim stays
  Pending until the first run creates a pod. Do not install with
  `--wait=watcher` or `--rollback-on-failure`, which would wait for the
  claim; Helm's default (`hookOnly`) is right for a CronJob.

## Regression alerts: the baseline

Save a report you accept as the baseline, in a ConfigMap in the release's
namespace:

```sh
kubectl -n inference create configmap tokvera-baseline --from-file=report.json=report.json
helm upgrade scan … --reuse-values --set baseline.existingConfigMap=tokvera-baseline
```

- **What the summary does:** it compares every run with that report through
  `tokvera scan summary --baseline` (thresholds as in the table, inclusive).
  A regression exits 1, so the Job fails and the log lists each regression.
  A different target, model or suite is a warning, not a failure.
- **The baseline is fixed on purpose:** comparing each run with the one
  before it would let a slow drift pass forever, one small step at a time,
  and it would need a shell to rotate files. Move the baseline when you
  accept a new level, by replacing the ConfigMap.
- **Turning a failed run into an alert:** set
  `alerts.prometheusRule.enabled=true`. It needs the Prometheus Operator's
  PrometheusRule CRD (the chart refuses to render without it) and
  kube-state-metrics.
  - **The alert:** `TokveraScanRunFailed` fires when the CronJob's latest
    scheduled run is not a success. It reads the STABLE kube-state-metrics
    series `kube_cronjob_status_last_schedule_time`,
    `kube_cronjob_status_last_successful_time` and
    `kube_cronjob_status_active` (kube-state-metrics
    docs/metrics/workload/cronjob-metrics.md).
  - **What fails a run:** a regression, a grade below `scan.failUnder`, or a
    scan that could not complete. The summary log, then the scan log, says
    which.
  - **One blind spot:** a CronJob that has never succeeded has no
    last-success time, so its failures are silent until the first success.

## Hardening

- **The pod:** non-root (uid and gid 65532, as in the image), `fsGroup` 65532
  for the claim, no service-account token, `restartPolicy: Never`.
- **Each container:** read-only root filesystem, no privilege escalation,
  every capability dropped, the runtime's default seccomp profile. `/tmp` is
  a 64Mi emptyDir, and the summary mounts the reports read-only.
- **Resources:** requests and limits on both containers. The schema refuses
  limits without cpu and memory.
- **Pod Security:** this meets the `restricted` Pod Security Standard. The
  kind smoke test installs the chart into a namespace that enforces it.
- **The API key:** it comes only from an existing Secret, as an environment
  variable the scan reads by name (`--api-key-env`). It never appears in the
  chart's values or in the pod's arguments.

## Verifying a published chart

The release workflow signs the chart with keyless cosign and gives it SLSA
provenance, as it does the image:

```sh
cosign verify ghcr.io/rajasatyajit/charts/tokvera:0.2.0 \
  --certificate-identity-regexp '^https://github\.com/rajasatyajit/tokvera/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
gh attestation verify oci://ghcr.io/rajasatyajit/charts/tokvera:0.2.0 --repo rajasatyajit/tokvera \
  --signer-workflow rajasatyajit/tokvera/.github/workflows/release.yml
```

## Tests

- **Default suite:** `go test ./deploy/helm` renders the chart with `helm`
  (CI installs a pinned helm) and checks:
  - the consent gate and the hardening;
  - both containers' arguments, the claim, the baseline and the Secret;
  - that every flag the chart passes is one the binary defines;
  - the schema's refusals, and its grades against the scoring bands;
  - the PrometheusRule's CRD gate.
- **`make helm-kind`:** installs the chart into a kind cluster under the
  `restricted` Pod Security Standard and scans Tokvera's simulator
  in-cluster three times: with no baseline (then reads both reports back
  from the claim), with a baseline it passes, and with one it regresses
  against, whose Job must fail.
