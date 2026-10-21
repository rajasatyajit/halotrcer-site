---
title: Installing tokvera
source:
  repo: tokvera
  path: docs/install.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: false
order: 13
---

Every channel below installs a published GitHub release of
[rajasatyajit/tokvera](https://github.com/rajasatyajit/tokvera). Each release
carries `checksums.txt` (SHA-256 of every archive and package) and a keyless
[cosign](https://docs.sigstore.dev/) signature of that file,
`checksums.txt.sigstore.json`, made by the repository's release workflow.

| Platform | Quickest | Package manager |
| --- | --- | --- |
| Linux | `curl -fsSL https://tokvera.halotrcer.com/install.sh \| sh` | deb, rpm, apk (below) |
| macOS | `curl -fsSL https://tokvera.halotrcer.com/install.sh \| sh` | `brew install --cask rajasatyajit/tap/tokvera` |
| Windows | `irm https://tokvera.halotrcer.com/install.ps1 \| iex` | `scoop install rajasatyajit/tokvera`, `winget install -e --id Halotrcer.Tokvera` |
| Any (Go 1.26+) | `go install github.com/rajasatyajit/tokvera/cmd/tokvera@latest` | |
| Container | `docker run --rm ghcr.io/rajasatyajit/tokvera:latest version` | |

The install scripts are `scripts/install.sh` and `scripts/install.ps1` in this
repository; `tokvera.halotrcer.com` serves the same files. To read before you
run, download first:

```sh
curl -fsSLO https://raw.githubusercontent.com/rajasatyajit/tokvera/main/scripts/install.sh
less install.sh && sh install.sh
```

## The install scripts

Both scripts do the same steps, each commented in the source:

1. Detect the platform. On Apple Silicon a shell running under Rosetta 2
   still gets the native arm64 build; on Windows on Arm an emulated x64
   PowerShell does too. musl Linux (Alpine) gets the standard Linux build,
   which is statically linked.
2. Resolve the version: the latest **published** release, unless you name one.
3. Stop if that version is already installed, so running the script again is
   safe; an older version is replaced.
4. Download the archive and `checksums.txt` from the GitHub release.
5. Verify. When `cosign` is installed, first check that `checksums.txt` was
   signed by this repository's release workflow on a version tag; then check
   the archive's SHA-256 against its line in `checksums.txt`. Any failure
   stops the install before anything is written.
6. Install the binary atomically (written beside the destination, then renamed
   over it), and print a PATH hint when the directory is not on PATH. The
   scripts never edit PATH or shell profiles themselves.

They contact only GitHub (`api.github.com` to resolve "latest",
`github.com` for the release files) and send nothing else. With `--dry-run`
they contact nothing at all.

### `install.sh` (Linux, macOS)

POSIX `sh`; tested with bash, dash and busybox ash. Needs `curl` or `wget`,
`tar`, `mktemp`, `uname`, and one of `sha256sum`, `shasum` or `openssl`.

| Option | Meaning |
| --- | --- |
| `--version VERSION` | install this release, e.g. `v0.2.0` (default: latest) |
| `--dir DIR` | install into `DIR` (default: `$HOME/.local/bin`) |
| `--global` | install into `/usr/local/bin`, using `sudo` only if that directory is not writable |
| `--dry-run` | print the plan; download and change nothing |
| `--no-verify` | skip the SHA-256 and signature checks (not recommended) |
| `--require-cosign` | fail unless cosign is installed and the signature verifies |

Pass options through a pipe with `sh -s --`:

```sh
curl -fsSL https://tokvera.halotrcer.com/install.sh | sh -s -- --version v0.2.0 --require-cosign
```

Exit codes: `0` installed, already installed, or dry run; `1` failure;
`2` usage error.

### `install.ps1` (Windows)

Windows PowerShell 5.1 or PowerShell 7. Installs `tokvera.exe`.

| Parameter | Meaning |
| --- | --- |
| `-Version VERSION` | install this release (default: latest) |
| `-Dir DIR` | install into `DIR` (default: `$env:LOCALAPPDATA\Programs\tokvera`) |
| `-Global` | install into `$env:ProgramFiles\tokvera` (run PowerShell as administrator) |
| `-DryRun` | print the plan; download and change nothing |
| `-NoVerify` | skip the SHA-256 and signature checks (not recommended) |
| `-RequireCosign` | fail unless cosign is installed and the signature verifies |

Parameters cannot follow `| iex`; use a script block instead:

```powershell
& ([scriptblock]::Create((irm https://tokvera.halotrcer.com/install.ps1))) -Version v0.2.0 -RequireCosign
```

**Red lines are normal on Windows PowerShell 5.1.** tokvera writes its
progress, such as "Scan plan for …", to stderr, which is the right stream for
it. Windows PowerShell 5.1 shows a native program's stderr in red, sometimes
under a `NativeCommandError` heading, even when the command succeeded. Judge
the result by the exit code (`$LASTEXITCODE`), not the colour. PowerShell 7
shows the same lines plainly. The installer itself runs native programs in a
way 5.1 cannot abort, so a successful install never ends in that error.

Run as a file (`powershell -ExecutionPolicy Bypass -File install.ps1 …`) the
exit codes match `install.sh`; through `iex` or a script block the script
never calls `exit` (that would close your shell) and sets `$LASTEXITCODE`.

### Mirrors

`TOKVERA_INSTALL_DOWNLOAD_BASE` (default
`https://github.com/rajasatyajit/tokvera/releases/download`) and
`TOKVERA_INSTALL_API_BASE` (default
`https://api.github.com/repos/rajasatyajit/tokvera`) point both scripts at a
mirror with the same layout. An override must be `https`, or plain `http` to a
loopback address only; anything else is a usage error. The checks are the
same, so a mirror cannot substitute a binary unless it can also forge the
checksum file (and, with cosign installed, its signature).

## Homebrew (macOS)

```sh
brew install --cask rajasatyajit/tap/tokvera
```

**The macOS binary is not notarized by Apple.** Homebrew downloads the archive
and checks its SHA-256 against the cask; the cask then removes macOS's
quarantine flag from the one `tokvera` binary it installed, so Gatekeeper does
not refuse it as "damaged". That means Apple has not vouched for the binary:
the guarantee is the checksum and the cosign signature. To check the signature
yourself:

```sh
TAG=v0.2.0   # the version you installed: tokvera version
curl -fsSLO "https://github.com/rajasatyajit/tokvera/releases/download/$TAG/checksums.txt"
curl -fsSLO "https://github.com/rajasatyajit/tokvera/releases/download/$TAG/checksums.txt.sigstore.json"
cosign verify-blob --bundle checksums.txt.sigstore.json \
  --certificate-identity-regexp '^https://github\.com/rajasatyajit/tokvera/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  checksums.txt
```

`Verified OK` means the file was signed by this repository's release workflow
running on a version tag. Then compare the archive's SHA-256
(`shasum -a 256 tokvera_*_darwin_*.tar.gz`) with its line in `checksums.txt`.
`install.sh` is the alternative: it checks the same signature when cosign is
installed, and a binary it downloads with curl or wget is not quarantined in
the first place.

## Scoop and winget (Windows)

```powershell
scoop bucket add rajasatyajit https://github.com/rajasatyajit/scoop-bucket
scoop install rajasatyajit/tokvera

winget install -e --id Halotrcer.Tokvera
```

The winget manifest reaches the community repository through a pull request
that Microsoft reviews, so a new version can appear there later than on GitHub.

## Linux packages

Each release has `.deb`, `.rpm` and `.apk` packages for amd64 and arm64. They
install `/usr/bin/tokvera` and the README, CHANGELOG, LICENSE and NOTICE under
`/usr/share/doc/tokvera/`.

```sh
# Debian, Ubuntu
sudo apt install ./tokvera_0.2.0_amd64.deb
# Fedora, RHEL
sudo dnf install ./tokvera-0.2.0-1.x86_64.rpm
```

**Alpine (signed apk).** The apk packages are signed with an RSA key. Install
its public key once, then apk verifies every package without
`--allow-untrusted`:

```sh
wget -O /etc/apk/keys/satyajit.rajaraman@halotrcer.com-tokvera.rsa.pub \
  https://raw.githubusercontent.com/rajasatyajit/tokvera/main/packaging/keys/satyajit.rajaraman@halotrcer.com-tokvera.rsa.pub
apk add ./tokvera_0.2.0_x86_64.apk
```

### The apt and yum repositories

From the first release on, the same packages are served from signed
repositories at `https://rajasatyajit.github.io/packages/`, so the system
package manager installs and updates tokvera. The repository metadata
(`InRelease`, `repomd.xml`) and every package are signed with the OpenPGP key
`halotrcer-packages.asc` (fingerprint
`D2D9 6618 831A C55B 81E2  4DA3 039B 5DA0 D3E3 9071`; the same file is in
`packaging/keys/`).

Debian, Ubuntu:

```sh
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl -fsSLo /etc/apt/keyrings/halotrcer-packages.asc \
  https://rajasatyajit.github.io/packages/halotrcer-packages.asc
echo "deb [signed-by=/etc/apt/keyrings/halotrcer-packages.asc] https://rajasatyajit.github.io/packages/apt stable main" |
  sudo tee /etc/apt/sources.list.d/tokvera.list
sudo apt update && sudo apt install tokvera
```

Fedora, RHEL, Amazon Linux (dnf checks the metadata and every package against
the key, which it offers to import on first use):

```sh
sudo curl -fsSLo /etc/yum.repos.d/tokvera.repo https://rajasatyajit.github.io/packages/rpm/tokvera.repo
sudo dnf install tokvera
```

Every release stays in the repositories, so `apt install tokvera=0.2.0` or
`dnf install tokvera-0.2.0` pins a version.

## Container image

`ghcr.io/rajasatyajit/tokvera` is a distroless, non-root (uid 65532) image for
linux/amd64 and linux/arm64. Each pushed image is cosign-signed by the same
release workflow:

```sh
cosign verify ghcr.io/rajasatyajit/tokvera:v0.2.0 \
  --certificate-identity-regexp '^https://github\.com/rajasatyajit/tokvera/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

## The caching proxy (tokvera-cache)

`tokvera cache` runs `tokvera-cache`, a second program
(docs/audit-kit.md). The deb, rpm and apk packages install it beside
`tokvera`. Elsewhere, download `tokvera-cache_<version>_<os>_<arch>` from the
same release (it is in the same `checksums.txt`), and put `tokvera-cache`
next to `tokvera` or on PATH.

## Helm chart

`oci://ghcr.io/rajasatyajit/charts/tokvera` runs the scan on a schedule inside
a Kubernetes cluster (a CronJob that keeps the latest report and can fail on
a regression). See docs/helm.md.

## Build provenance (SLSA)

Every archive, package and SBOM in `checksums.txt`, and the container image,
carries a SLSA v1 build provenance attestation made by the same release
workflow on the version tag. It records which workflow, commit and runner
built the file. Check it with the GitHub CLI:

```sh
gh attestation verify tokvera_0.2.0_linux_amd64.tar.gz --repo rajasatyajit/tokvera \
  --signer-workflow rajasatyajit/tokvera/.github/workflows/release.yml
gh attestation verify oci://ghcr.io/rajasatyajit/tokvera:v0.2.0 --repo rajasatyajit/tokvera \
  --signer-workflow rajasatyajit/tokvera/.github/workflows/release.yml
```

Without access to GitHub's API (an air-gapped host), download the release's
`tokvera_<version>_provenance.sigstore.json` beside the archive and add
`--bundle tokvera_0.2.0_provenance.sigstore.json` to the first command.

## Uninstall

The scripts install one file: delete it (`rm ~/.local/bin/tokvera`, or
`/usr/local/bin/tokvera` after `--global`; on Windows the `tokvera.exe` in the
install directory). Package managers: `brew uninstall --cask tokvera`,
`scoop uninstall tokvera`, `winget uninstall Halotrcer.Tokvera`,
`sudo apt remove tokvera`, `sudo dnf remove tokvera`, `apk del tokvera`.
