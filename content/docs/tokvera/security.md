---
title: Security
source:
  repo: tokvera
  path: SECURITY.md
  ref: main
  commit: ca4ed28d816d01ffee0b0707a2d6b2cdf4387735
prelaunch: true
order: 16
---

## Reporting a vulnerability

Email **satyajit.rajaraman@halotrcer.com** with "tokvera security" in the
subject. Please do not open a public issue for a vulnerability.

Include what you can of:
- the tokvera version (`tokvera version`) and how it was installed;
- the command and flags, or the input, that triggers it;
- what happens, and what you expected.

Do not send real prompts, API keys or client data: a reproduction with
made-up content is enough.

We aim to acknowledge reports within 5 business days, and to tell you what
happens next.

## Supported versions

Tokvera is before 1.0. Fixes go into the next release; there are no
maintained older release lines. `tokvera doctor --check-update` tells you
whether a newer release exists.

## What a release proves

- **Signature:** every release's `checksums.txt` is signed with cosign,
  keyless, by this repository's release workflow running on a version tag.
  The install scripts check it when cosign is installed, and always check
  the SHA-256 of what they download against `checksums.txt`.
- **Provenance:** every archive, package, SBOM and the container image
  carries a SLSA v1 build provenance attestation from the same workflow.
- **Packages:** deb, rpm and apk packages, and the apt and yum repository
  metadata, are signed with the keys in [packaging/keys](packaging/keys).
- **SBOMs:** each archive ships with one.

[docs/install.md](docs/install.md) has the commands to check each of these
yourself.

## What tokvera does with your data

- **No telemetry.** Tokvera contacts only the target you specify, plus GitHub when you run update or doctor --check-update, and tokvera.halotrcer.com and GitHub for the plugin's first-run install.
- **Prompts and responses never appear in a report,** a log or an error
  message. Tests plant marker text in the inputs and check every output
  for it.
- **API keys** are read from environment variables when a request is made.
  They are never a command-line flag and never appear in output.
- **What a scan sends:** one fixed benchmark prompt per request, to the target
  you name, after you have seen the plan and its caps.
  `--prompts FILE` is read locally and never sent.
- **What an audit sends:** nothing by default. If you configure an embedding
  provider, prompt texts go to that endpoint, which must be on this machine
  unless you allow a remote one. If you configure a language model for the
  report's prose, it receives the findings: service names and measurements,
  never prompt or completion text.
- **Redirects are refused** on every outbound request, so a key or request
  body cannot be forwarded to a host you did not name.

[docs/audit.md](docs/audit.md) has the audit's data handling in full.
