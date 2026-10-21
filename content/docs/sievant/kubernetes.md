---
title: Sievant on Kubernetes
source:
  repo: sievant
  path: docs/kubernetes.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: false
order: 6
---

The Helm chart (`charts/sievant`, published as
`oci://ghcr.io/rajasatyajit/charts/sievant`) runs Sievant in one of two
modes:

- **gateway**: a central MCP egress point. Agents anywhere in the cluster
  call Sievant's Service; Sievant calls the MCP servers.
- **sidecar**: a mutating admission webhook injects Sievant into agent pods.
  Each agent talks to its own Sievant on 127.0.0.1.

Kubernetes 1.30 or later (native sidecars, webhook match conditions). Every
pod the chart runs, and the injected sidecar, meets the `restricted` Pod
Security Standard: non-root (uid 65532), read-only root filesystem, no
privilege escalation, all capabilities dropped, `RuntimeDefault` seccomp.
Sievant's own pods carry `sievant.io/inject: "false"`.

Every value is checked against `values.schema.json`; unknown keys are
refused. `values.yaml` describes each one.

## Gateway mode

```yaml
# values.yaml
mode: gateway
gateway:
  config:
    existingSecret: sievant-config   # key sievant.yaml (or config.inline)
  tls:
    existingSecret: sievant-tls      # kubernetes.io/tls (or certManager)
  env:
    - name: ORDERS_DB_DSN
      valueFrom: {secretKeyRef: {name: orders-db, key: dsn}}
```

```sh
helm install sievant oci://ghcr.io/rajasatyajit/charts/sievant --version <v> \
  --namespace sievant --create-namespace -f values.yaml
```

The configuration is an ordinary Sievant configuration (`sievant init`
writes one; docs/configuration.md). In the chart it must:

- listen on `0.0.0.0:<gateway.port>` (default 8443), with
  `tls.mode: direct` and the certificate at `/etc/sievant/tls/tls.crt` and
  `tls.key`, or `upstream_terminated` behind a TLS proxy;
- keep its audit store under `/var/lib/sievant` (an `emptyDir` per pod, of
  `gateway.auditVolume.sizeLimit`);
- set `metrics.listen_addr: 0.0.0.0:<gateway.metrics.port>` to serve
  metrics (default port 9090; `gateway.metrics.serviceMonitor.enabled` adds
  a ServiceMonitor).

The audit HMAC key comes from `gateway.hmacKey.existingSecret`, or a Secret
the chart creates once and keeps across upgrades and uninstalls (audit
records are keyed with it). `${VAR}` references in the configuration
resolve from `gateway.env`.

What the chart adds around the Deployment: a Service, a
HorizontalPodAutoscaler on CPU (2 to 10 replicas by default), a
PodDisruptionBudget (one pod available), and a NetworkPolicy. The policy
lets `gateway.networkPolicy.ingressFrom` peers reach the MCP port (default:
any pod) and allows egress to DNS and TCP 443 (`gateway.networkPolicy.egress`
replaces the latter).

Each pod has its own audit store. For one trail across replicas, and one
that outlives pods, add `audit.export` to the configuration: OTLP logs,
syslog or a signed webhook (docs/telemetry.md).

**Make Sievant the only way to the MCP servers.** A gateway guards only
what goes through it. Give the MCP servers a NetworkPolicy that admits only
the gateway pods (`app.kubernetes.io/component: gateway`,
`app.kubernetes.io/instance: <release>`).

## Sidecar mode

```yaml
# values.yaml
mode: sidecar
profile: strict            # fail-closed webhook (see below)
sidecar:
  namespaces: [agents]     # where to write the sidecar's ConfigMap and Secret
  config: |
    server:
      transport: http
      http:
        listen_addr: "127.0.0.1:${SIEVANT_SIDECAR_PORT}"
        path: /mcp
        tls: {mode: loopback}
      limits: {max_clients: 8, max_inflight_calls: 8, max_queued_calls: 8, call_timeout: 60s}
    identity:
      provider: static
      agents: [{name: pod-agent}]
      static: {agent: pod-agent}
    policies:
      - agent: pod-agent
        allow: [crm_lookup]
    rate_limit:
      default: {requests_per_second: 10, burst: 20}
    sanitization:
      hmac_key: ${SIEVANT_HMAC_KEY}
    audit:
      sink: local
      local: {path: /var/lib/sievant/audit.db}
    connectors:
      mcp:
        - name: crm
          url: https://crm-mcp.tools.svc/mcp
          tool_prefix: crm_
```

```sh
helm install sievant oci://ghcr.io/rajasatyajit/charts/sievant --version <v> \
  --namespace sievant --create-namespace -f values.yaml
kubectl label namespace agents sievant.io/inject=enabled
```

**Which pods get the sidecar:**

- every pod created in a namespace labelled `sievant.io/inject=enabled`,
  unless the pod is annotated `sievant.io/inject: "false"`;
- a pod annotated `sievant.io/inject: "true"`, in any other namespace;
- never pods of the release's own namespace or the `kube-*` namespaces
  (`sidecar.injector.excludeNamespaces` adds more);
- never a pod with `hostNetwork: true`: it is refused, because its loopback
  would be the node's.

A pod that already has the sidecar is left alone, and the injector only
adds to a pod: it changes nothing that is there.

**What the injector adds:**

- a native sidecar (an init container with `restartPolicy: Always`, first
  among the init containers), so it is running and ready before the app
  containers start;
- `SIEVANT_MCP_URL=http://127.0.0.1:<sidecar.port>/mcp` in each app
  container that does not set it (agents use it as their MCP endpoint);
- the ConfigMap and Secret named by the pod's `sievant.io/config`
  annotation (default `sievant-sidecar`), mounted from the pod's own
  namespace, and an `emptyDir` for the audit store;
- the annotation `sievant.io/injected: <version>`.

**The sidecar's probes.** Its startup and readiness probes run
`sievant health 127.0.0.1:<sidecar.port>` in the container (an exec
probe). The command only opens a TCP connection, with a 2-second timeout
(`--timeout`), and exits 0 if the port accepts it, 1 if not, 2 on a usage
error; it sends nothing and prints nothing on success. A `tcpSocket` or
`httpGet` probe will not do here: without a host it reaches the pod's IP,
where the sidecar does not listen, and the `restricted` Pod Security
Standard refuses a probe that names a host. The image has no shell, so the
check is a Sievant command. The same command serves as a Docker or Compose
healthcheck (examples/compose).

The ConfigMap holds the sidecar's `sievant.yaml`, and the Secret its HMAC
key (`hmac-key`). The chart writes both to each of `sidecar.namespaces`;
for other namespaces, create them yourself. A pod whose ConfigMap or Secret
is missing does not start, so it is never run unguarded.

The sidecar's configuration must listen on
`127.0.0.1:${SIEVANT_SIDECAR_PORT}` with `tls.mode: loopback`, which serves
plain HTTP on a loopback address only and allows `static` identity: only
processes in the pod can connect. docs/threat-model.md has the residual
risks.

**Failure policy.** When the injector cannot be reached:
- `Fail` (fail-closed): the pod is not created.
- `Ignore` (fail-open): the pod is created without the sidecar.

The default is `Fail` for `profile: strict` only, `Ignore` otherwise;
`sidecar.injector.failurePolicy` sets it. Each of the two webhooks has a
match condition, so only pods that are to be injected ever reach the
injector. A fail-closed policy therefore holds up only those pods, never
every pod creation in the cluster. Run two injector replicas (the default;
a PodDisruptionBudget keeps one up) when failing closed.

**Certificates.** By default the injector keeps its own CA (5 years) and
serving certificate (1 year) in the Secret `<release>-webhook-tls`:
- the serving certificate is renewed 30 days before it expires;
- the CA is renewed a year before it expires;
- the CA bundle of the webhook configuration is patched to match, and
  checked every ten minutes.

When the CA is replaced, the bundle carries both CAs, and the serving
certificate changes only at its own renewal. The API server never meets a
certificate its bundle does not trust. For this the injector needs:
- `get` and `update` on that one Secret, and `create` on Secrets in its
  namespace;
- `get` and `patch` on the one webhook configuration.

With `sidecar.injector.certManager.enabled`, cert-manager issues the
certificate and injects the CA bundle, and the injector needs no API access
at all.

**Bypass.** The sidecar guards the calls the agent sends to it. An agent
that ignores `SIEVANT_MCP_URL` and calls an MCP server directly is not
guarded. A NetworkPolicy cannot stop that, because the agent and the
sidecar share the pod's network identity. Have the MCP servers accept only
callers that present the sidecar's connector credentials, which the agent
does not hold.

## Metrics, traces and audit export

Prometheus metrics: `metrics.listen_addr` in the configuration (gateway:
the Service's `metrics` port). Traces (OTLP/HTTP) and audit export to SIEMs
(OTLP logs, syslog, webhook): docs/telemetry.md. The same configuration
keys work in both modes.

## Uninstall

`helm uninstall` removes the webhook configuration first, so no pod is
injected or held up after that. Pods already injected keep their sidecar
until they are replaced. The HMAC key Secrets stay (`helm.sh/resource-policy:
keep`); delete them once their audit records are no longer needed.

## Troubleshooting

- *A pod is not created, "failed calling webhook":* the injector is down and
  the failure policy is `Fail`. `kubectl -n <release-ns> get pods,events`;
  check the injector logs. To create pods anyway, set
  `sidecar.injector.failurePolicy: Ignore`.
- *A pod is stuck in `Init` / `CreateContainerConfigError`:* its namespace
  lacks the `sievant-sidecar` ConfigMap or Secret (or the one its
  `sievant.io/config` annotation names).
- *The sidecar is not ready:* `kubectl describe pod <pod>` shows the
  probe's output (`not accepting: ...`). The sidecar has not bound
  `127.0.0.1:<sidecar.port>`: check its logs (next item) and that the
  configuration listens on `127.0.0.1:${SIEVANT_SIDECAR_PORT}`.
- *The sidecar restarts:* `kubectl logs <pod> -c sievant`. A configuration
  error is printed with the key and the reason.
- *A pod is not injected:* check the namespace label
  (`sievant.io/inject=enabled`) or the pod annotation, and that the
  namespace is not excluded. `kubectl get pod <pod> -o
  jsonpath='{.metadata.annotations.sievant\.io/injected}'` is set on
  injected pods.
