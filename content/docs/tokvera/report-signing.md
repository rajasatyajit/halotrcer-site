---
title: Signing reports
source:
  repo: tokvera
  path: docs/report-signing.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 3
---

`tokvera report sign` puts a signature on a scan report or an audit bundle. A
client, or anyone the report reaches later, can then check that it is
exactly what was produced, where, and by which tokvera.

```sh
cosign generate-key-pair                                   # once: cosign.key, cosign.pub
tokvera report sign   --report tokvera-scan --key cosign.key
tokvera report verify --report tokvera-scan --key cosign.pub
```

## What is signed

`sign` writes `attestation.json` into the report directory and has cosign sign
it into `attestation.sigstore.json`.

- **The files:** every file in the directory (a scan's `report.json` and
  `report.html`, or a whole audit bundle with its fix pack), each with its
  SHA-256 and size. A link is refused.
- **The environment:**
  - tokvera's version and commit, the Go version, the OS and architecture,
    and the CPU count;
  - the SHA-256 of the host name. Two reports can be shown to come from one
    machine without the attestation naming it.
- **The environment fingerprint:** one digest of all of the above.
- **What the report is:** a scan report and its target, or an audit bundle
  and its audit id.

## Keys, or your identity

- **`--key cosign.key`:** signs with a cosign key pair. Nothing leaves your
  machine. Pass `--tlog` to also record the signature in Sigstore's public
  transparency log, which proves when it was signed. Without the log, the
  signing time is the signer's word, and `verify` says so.
- **`--keyless`:** signs with your OIDC identity (cosign opens a browser). It
  records your identity and the attestation's digest in Sigstore's **public**
  transparency log. The report's contents are not sent.
- **No default:** you choose one, because only one of them publishes.

## Verifying

```sh
tokvera report verify --report DIR --key cosign.pub
tokvera report verify --report DIR --certificate-identity you@example.com \
  --certificate-oidc-issuer https://accounts.google.com
```

- **First, the signature:** cosign checks the attestation's signature. Any
  edit to the attestation fails it.
- **Then, every file:** each is re-hashed against the attestation. A
  changed, missing or added file fails, and every difference is named.
- **On success,** the command prints what was signed, by which tokvera, where
  and when.
- **Exit codes:** 0 verified, 1 not.

cosign is an external program (https://docs.sigstore.dev/cosign/system_config/installation/);
`tokvera doctor` says whether it is installed.
