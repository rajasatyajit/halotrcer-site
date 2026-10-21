---
title: Audit kits
source:
  repo: tokvera
  path: docs/kit.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 12
---

An audit kit adds playbooks and fix-pack templates to the ones built into
Tokvera, at run time, without changing anything else. It is how premium
content that is not part of this open-source repository reaches an audit
(PLAN R2).

```sh
tokvera audit --config audit.yaml --kit premium-1.0.tar.gz
tokvera demo --kit premium-1.0.tar.gz
tokvera playbooks validate --kit premium-1.0.tar.gz [dir]
```

Without `--kit`, every command behaves exactly as before.

## What a kit holds

```
playbooks/*.yaml                   playbooks, in the same schema as playbooks/ here
templates/fixpack/<artifact-id>/   fix-pack template directories, as templates/fixpack/ here
*.md, LICENSE*, NOTICE*            the kit's own docs and licence (ignored)
```

Anything else is refused: code, configuration, links, and the metrics catalog
(`templates/fixpack/metrics.json` is not a kit's to change; a kit template
that declares a metric the built-in catalog does not know fails the fix-pack
checks, which the delivery checklist reports). Every kit playbook must pass
the playbook schema, and every artifact a playbook names must exist in the
kit or in Tokvera.

- **A kit playbook or artifact with the same id as a built-in one replaces
  it.** An artifact is replaced as a whole directory, never file by file.
  Each replacement is a clash, and clashes are reported.
- **What the run says about the kit:** stderr prints one line for the kit
  and one per clash. `run-manifest.json` gains a `kit` object (source, form,
  sha256, signed, key id, playbooks, artifacts, clashes). `review-notes.md`
  and `DELIVERY-CHECKLIST.md` carry the same account.
- **What it does not say:** the client report never mentions the kit. The
  kit's playbooks appear in the plan like any other, but how the bundle was
  produced is the consultant's business, not the client's.

## Two forms

- **A directory** is the development form: it is read in place and is never
  signed. The manifest, review notes and checklist say "UNSIGNED kit
  directory", and the checklist asks for a re-run with the signed bundle
  before delivery.
- **A bundle** is what a delivered audit uses: the same layout as a
  `.tar.gz`, with a detached Ed25519 signature beside it named
  `<bundle>.sig`.
  - Tokvera reads the bundle once and verifies those exact bytes against the
    signing keys built into this binary. Only then does it unpack them, into
    a private temporary directory that is removed when the run ends.
  - A bundle with no signature, a signature from an untrusted key, or bytes
    that changed after signing is refused. The command exits 1 before
    anything is analyzed, and no bundle is written.
  - Unpacking refuses absolute or escaping paths, links, devices, duplicate
    entries, a file over 8 MiB, more than 128 MiB unpacked, and more than
    4096 entries. The compressed bundle may be at most 64 MiB.

## Making a bundle

From the kit's directory:

```sh
tar -czf premium-1.0.tar.gz playbooks templates LICENSE
```

`tokvera playbooks validate --kit <kit directory>` checks the content with the
library first (the directory form needs no signature).

## Signing a kit release

Kits are signed locally, with the owner's offline key, never in CI. From a
checkout of this repository:

```sh
make kit-sign KIT=premium-1.0.tar.gz KEY=/secure/kit-signing.pem
```

which runs `scripts/kit/sign.sh`. The exact openssl commands it runs, if you
prefer to type them:

```sh
openssl pkeyutl -sign -inkey /secure/kit-signing.pem -rawin \
  -in premium-1.0.tar.gz -out premium-1.0.tar.gz.sig
openssl pkeyutl -verify -pubin -inkey packaging/keys/kit/halotrcer-kit.pub.pem -rawin \
  -in premium-1.0.tar.gz -sigfile premium-1.0.tar.gz.sig
```

- **Check before you ship:** the second command must print "Signature
  Verified Successfully". The script runs it for you and deletes the
  signature if it fails, which happens when the key is not the private half
  of the key every release binary trusts. It also refuses to run when `CI`
  is set.
- **What to ship:** both files, `premium-1.0.tar.gz` and
  `premium-1.0.tar.gz.sig`. `tokvera playbooks validate --kit
  premium-1.0.tar.gz` is a last check, using exactly what users will run.
- **The signature file:** the 64 raw bytes `openssl pkeyutl` writes. The same
  bytes in base64 also verify.

## Keys

Tokvera trusts the Ed25519 public keys in `packaging/keys/kit/` (`*.pub` and
`*.pub.pem`), embedded at build time. This build trusts exactly one: the
owner's, `halotrcer-kit.pub.pem`, key id `c03b435b8390516f` (the first 16 hex
digits of the sha256 of the DER public key, which `run-manifest.json`
records). `TestKitTrustsExactlyTheOwnerKey` pins it.

The private half was generated offline (`openssl genpkey -algorithm ed25519`)
and stays there. It never enters this repository or CI: `.gitignore`, the
pre-commit hook and `TestNoPrivateKeyMaterialTracked` refuse private key
material. To rotate, add the new public key beside the old one, sign new kits
with the new key, then remove the old key, moving the test's pin with it.
