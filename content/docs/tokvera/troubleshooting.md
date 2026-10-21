---
title: Troubleshooting
source:
  repo: tokvera
  path: docs/troubleshooting.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: false
order: 15
---

<!-- Generated from cmd/tokvera/troubleshooting.go; edit that file, then run
     go test ./cmd/tokvera -run TestTroubleshootingDocIsGenerated -update-doc -->

Start with `tokvera doctor`. It checks the installation and every tool tokvera uses,
and prints the exact fix for each problem. `tokvera doctor --json` is the same for a
script, and nothing it checks contacts the network unless you add `--check-update`.

## What doctor checks

### tokvera

Reports the version, commit, commit date and Go version, where the binary is, how it was installed and how that install is updated.

### config

Reads the global configuration: the config file and every TOKVERA_* variable (docs/config.md).

Fails on a value that does not parse, an unknown key, or a file that is not YAML. Every command except help, version and doctor stops with exit 2 until it is fixed; doctor reports it instead.

Doctor's fix: tokvera init --force (rewrites the config file), or correct the value named above.

### data

Finds the data directory, where tokvera stack keeps its files.

Warns when there is no home directory (or %LOCALAPPDATA% on Windows) to put it in.

Doctor's fix: pass --dir to tokvera stack up.

### pricing

Reads the embedded rate sheet behind scan's cost estimates: its as-of date and age.

Warns when it is more than 60 days old, so cost figures use old prices; update tokvera, or pass `tokvera scan --pricing FILE` with current prices. Fails when it does not load, which means a broken build.

Doctor's fix: the command depends on how tokvera was installed, and doctor prints the one for this machine: `tokvera update` for an install-script or archive install, otherwise your package manager's (for example `brew upgrade --cask tokvera` or `sudo apt-get install --only-upgrade tokvera`).

### docker

Looks for `docker` on PATH: `tokvera stack up` runs the observability stack with it.

Warns when it is missing.

Doctor's fix: install Docker: https://docs.docker.com/get-docker/.

### compose

Runs `docker compose version`, when docker is present: `tokvera stack up` needs the compose plugin.

Warns when it fails.

Doctor's fix: install the compose plugin: https://docs.docker.com/compose/install/linux/.

### helm

Looks for `helm` on PATH: it installs the values `tokvera stack helm-values` writes, and the tokvera chart.

Warns when it is missing.

Doctor's fix: install helm: https://helm.sh/docs/intro/install/.

### cosign

Looks for `cosign` on PATH: `tokvera update` and the install scripts check release signatures with it, and `tokvera report sign|verify` needs it.

Warns when it is missing (update and the install scripts then check the SHA-256 only).

Doctor's fix: install cosign: https://docs.sigstore.dev/cosign/system_config/installation/.

### go

Looks for `go` on PATH: `tokvera audit` compiles and tests the rendered fix pack with it.

Warns when it is missing (the audit's fix-pack checks are then structural only, and the checklist says so).

Doctor's fix: install Go: https://go.dev/doc/install.

### tokvera-cache

Looks for `tokvera-cache`, the caching proxy `tokvera cache` runs, beside tokvera and then on PATH.

Warns when it is in neither place.

Doctor's fix: download tokvera-cache_<version>_<os>_<arch> from the release (docs/install.md) and put it beside tokvera.

### update

With `--check-update` only: asks GitHub whether a newer release exists (no other check contacts anything).

Warns when one does, or when GitHub could not be reached.

Doctor's fix: the command depends on how tokvera was installed, and doctor prints the one for this machine: `tokvera update` for an install-script or archive install, otherwise your package manager's (for example `brew upgrade --cask tokvera` or `sudo apt-get install --only-upgrade tokvera`).

## Common messages

| Command | Message | What it means | What to do |
|---|---|---|---|
| scan | `scan: --target is required.` | no endpoint was named; tokvera never picks one itself | tokvera scan --target URL (the message lists what your environment suggests), or tokvera scan --demo |
| scan | `refusing to send load without confirmation: re-run with --yes (or from a terminal)` | a scan sends real load and there was no terminal to ask on | read the plan with --dry-run, then add --yes |
| scan | `lists N models; choose one with --model` | the endpoint serves several models | tokvera scan --target URL --model NAME |
| scan | `an Anthropic target needs --model` | the Anthropic API has no model list to choose from | pass --model |
| scan | `could not discover a model at` | the endpoint did not answer /v1/models (or with nothing usable) | pass --model, and check the URL ends where the API's /v1 starts |
| scan | `scan: warning:` | for example, the embedded rate sheet is more than 60 days old | tokvera update, or tokvera scan --pricing FILE with current prices |
| any | `tokvera: the global configuration is invalid; nothing was run:` | a config file value or TOKVERA_* variable is wrong | tokvera doctor names it; tokvera init --force rewrites the file |
| audit | `audit: config is invalid; nothing was analyzed:` | audit.yaml has errors; every one is listed | correct them (examples/audit.example.yaml is commented) |
| audit | `does not verify against any trusted kit key; refusing the bundle` | a kit bundle was signed by a key this build does not trust, or changed since signing | use the signed bundle as published (docs/kit.md) |
| audit | `beside the bundle; an unsigned bundle is refused` | a kit bundle has no .sig file next to it | put the bundle's .sig beside it, or pass the kit as a directory (docs/kit.md) |
| stack | `docker is not on PATH: install Docker Engine with the compose plugin` | tokvera stack needs Docker | install Docker (https://docs.docker.com/get-docker/) |
| update | `was installed by …; update it with:` | a package manager owns this tokvera | run the command it prints |
| cache | `cache: tokvera-cache is not installed` | the caching proxy is a separate program | download tokvera-cache from the release and put it beside tokvera |
| report | `report verify: the signature does not verify` | the attestation was changed, or the key or identity is not the signer's | check you have the signer's public key or identity |

Exit codes for every command are in [exit-codes.md](exit-codes.md).
