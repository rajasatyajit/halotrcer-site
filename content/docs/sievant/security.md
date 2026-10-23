---
title: Security
source:
  repo: sievant
  path: SECURITY.md
  ref: main
  commit: efa96682872b476c786a6d0f507aa17254000ac0
prelaunch: false
order: 12
---

## Reporting a vulnerability

Email **satyajit.rajaraman@halotrcer.com** with "sievant security" in the
subject, or use GitHub's private vulnerability reporting on this
repository (the "Report a vulnerability" button under Security). Please do
not open a public issue for a vulnerability.

Include what you can of:
- the Sievant version (`sievant version`) and how it was installed;
- the configuration, command or MCP messages that trigger it;
- what happens, and what you expected.

Do not send real credentials, tool results or customer data: a
reproduction with made-up content is enough.

We aim to acknowledge reports within 5 business days, and to tell you what
happens next.

## What counts

Sievant is a security control, so a way around it is a vulnerability.
For example:

- a tool call that reaches a server although the policy denies it, or
  skips the audit trail;
- a credential or personal data that the configured detectors should
  redact or block but that reaches the agent, the server, a log or the
  audit trail;
- a tool whose pinned definition changed but that is still served;
- `sievant ui` or the gateway's dashboard answering without
  authentication, or `sievant ui` listening beyond 127.0.0.1;
- `sievant wrap` or `unwrap` corrupting or losing a client configuration,
  or a backup that does not restore byte for byte;
- the Kubernetes injector or chart weakening a pod's security settings;
- a release artifact whose signature or provenance does not hold.

Prompt-injection detection is a heuristic score with measured false
negatives (docs/policies.md gives the figures). A missed injection is a
detection gap we want to hear about, with a sample, but not a
vulnerability on its own. docs/threat-model.md says what Sievant defends
against and what it does not.

## Supported versions

Sievant is before 1.0. Fixes go into the next release; there are no
maintained older release lines.

## What a release proves

- **Signature:** every release's `checksums.txt` is signed with cosign,
  keyless, by this repository's release workflow running on a version tag.
  The install scripts check it when cosign is installed, and always check
  the SHA-256 of what they download against `checksums.txt`.
- **Provenance:** every archive, package, SBOM, the container image and
  the Helm chart carries a SLSA v1 build provenance attestation from the
  same workflow. The image and the chart are also signed with cosign.
- **Packages:** deb, rpm and apk packages, and the apt and yum repository
  metadata, are signed with the keys in [packaging/keys](packaging/keys).
- **SBOMs:** each archive ships with one.

[docs/install.md](docs/install.md) has the commands to check each of these
yourself.

## What Sievant does with your data

- **No telemetry.** Sievant contacts only the MCP servers, backends and
  export endpoints you configure.
- **The audit trail stays on your machine,** in a SQLite file. It holds
  each call's arguments with secrets and personal data redacted and a
  keyed hash of the raw arguments; never the raw arguments, never tool
  results. It is exported only if you configure an export.
- **Secrets are masked** in everything `sievant scan`, `wrap` and
  `report` print or write, and in error messages and logs.
- **`sievant ui`** listens on 127.0.0.1 only, behind a one-time link. The
  gateway's dashboard is off unless configured; it has its own sign-in
  (an admin token or OIDC) and needs TLS on any non-loopback address.
