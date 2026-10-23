---
title: Installing Sievant
source:
  repo: sievant
  path: docs/install.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: false
order: 15
---

Every channel below installs a published GitHub release of
[rajasatyajit/sievant](https://github.com/rajasatyajit/sievant). Each release
carries `checksums.txt` (SHA-256 of every archive and package) and a keyless
[cosign](https://docs.sigstore.dev/) signature of that file,
`checksums.txt.sigstore.json`, made by the repository's release workflow.

| Platform | Quickest | Package manager |
| --- | --- | --- |
| Linux | `curl -fsSL https://sievant.halotrcer.com/install.sh \| sh` | deb, rpm, apk (below) |
| macOS | `curl -fsSL https://sievant.halotrcer.com/install.sh \| sh` | `brew install --cask rajasatyajit/tap/sievant` |
| Windows | `irm https://sievant.halotrcer.com/install.ps1 \| iex` | `scoop install rajasatyajit/sievant`, `winget install -e --id Halotrcer.Sievant` |
| Any (Go 1.26+) | `go install github.com/rajasatyajit/sievant/cmd/sievant@latest` | |
| Gateway service | a Linux package, then the systemd unit (below) | deb, rpm, apk |
| Container | `docker run --rm ghcr.io/rajasatyajit/sievant:latest version` | |

The install scripts are `scripts/install.sh` and `scripts/install.ps1` in this
repository; `sievant.halotrcer.com` serves the same files. To read before you
run, download first:

```sh
curl -fsSLO https://raw.githubusercontent.com/rajasatyajit/sievant/main/scripts/install.sh
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
7. Print the next steps: `sievant scan` (a read-only audit of the MCP client
   configurations on the machine), then `sievant wrap --all` (route those
   servers through Sievant; `sievant unwrap` restores the originals).

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
curl -fsSL https://sievant.halotrcer.com/install.sh | sh -s -- --version v0.2.0 --require-cosign
```

Exit codes: `0` installed, already installed, or dry run; `1` failure;
`2` usage error.

### `install.ps1` (Windows)

Windows PowerShell 5.1 or PowerShell 7. Installs `sievant.exe`.

| Parameter | Meaning |
| --- | --- |
| `-Version VERSION` | install this release (default: latest) |
| `-Dir DIR` | install into `DIR` (default: `$env:LOCALAPPDATA\Programs\sievant`) |
| `-Global` | install into `$env:ProgramFiles\sievant` (run PowerShell as administrator) |
| `-DryRun` | print the plan; download and change nothing |
| `-NoVerify` | skip the SHA-256 and signature checks (not recommended) |
| `-RequireCosign` | fail unless cosign is installed and the signature verifies |

Parameters cannot follow `| iex`; use a script block instead:

```powershell
& ([scriptblock]::Create((irm https://sievant.halotrcer.com/install.ps1))) -Version v0.2.0 -RequireCosign
```

**Red lines are normal on Windows PowerShell 5.1.** sievant writes its
logs and messages (and `sievant version`) to stderr, which is the right stream
for them. Windows PowerShell 5.1 shows a native program's stderr in red, sometimes
under a `NativeCommandError` heading, even when the command succeeded. Judge
the result by the exit code (`$LASTEXITCODE`), not the colour. PowerShell 7
shows the same lines plainly. The installer itself runs native programs in a
way 5.1 cannot abort, so a successful install never ends in that error.

Run as a file (`powershell -ExecutionPolicy Bypass -File install.ps1 …`) the
exit codes match `install.sh`; through `iex` or a script block the script
never calls `exit` (that would close your shell) and sets `$LASTEXITCODE`.

### Mirrors

`SIEVANT_INSTALL_DOWNLOAD_BASE` (default
`https://github.com/rajasatyajit/sievant/releases/download`) and
`SIEVANT_INSTALL_API_BASE` (default
`https://api.github.com/repos/rajasatyajit/sievant`) point both scripts at a
mirror with the same layout. An override must be `https`, or plain `http` to a
loopback address only; anything else is a usage error. The checks are the
same, so a mirror cannot substitute a binary unless it can also forge the
checksum file (and, with cosign installed, its signature).

## Homebrew (macOS)

```sh
brew install --cask rajasatyajit/tap/sievant
```

**The macOS binary is not notarized by Apple.** Homebrew downloads the archive
and checks its SHA-256 against the cask; the cask then removes macOS's
quarantine flag from the one `sievant` binary it installed, so Gatekeeper does
not refuse it as "damaged". That means Apple has not vouched for the binary:
the guarantee is the checksum and the cosign signature. To check the signature
yourself:

```sh
TAG=v0.2.0   # the version you installed: sievant version
curl -fsSLO "https://github.com/rajasatyajit/sievant/releases/download/$TAG/checksums.txt"
curl -fsSLO "https://github.com/rajasatyajit/sievant/releases/download/$TAG/checksums.txt.sigstore.json"
cosign verify-blob --bundle checksums.txt.sigstore.json \
  --certificate-identity-regexp '^https://github\.com/rajasatyajit/sievant/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  checksums.txt
```

`Verified OK` means the file was signed by this repository's release workflow
running on a version tag. Then compare the archive's SHA-256
(`shasum -a 256 sievant_*_darwin_*.tar.gz`) with its line in `checksums.txt`.
`install.sh` is the alternative: it checks the same signature when cosign is
installed, and a binary it downloads with curl or wget is not quarantined in
the first place.

## Scoop and winget (Windows)

```powershell
scoop bucket add rajasatyajit https://github.com/rajasatyajit/scoop-bucket
scoop install rajasatyajit/sievant

winget install -e --id Halotrcer.Sievant
```

The winget manifest reaches the community repository through a pull request
that Microsoft reviews, so a new version can appear there later than on GitHub.

## Linux packages

Each release has `.deb`, `.rpm` and `.apk` packages for amd64 and arm64. They
install `/usr/bin/sievant`, the README, CHANGELOG, LICENSE and NOTICE under
`/usr/share/doc/sievant/`, and the gateway-mode systemd unit (not enabled; see
below).

```sh
# Debian, Ubuntu
sudo apt install ./sievant_0.2.0_amd64.deb
# Fedora, RHEL
sudo dnf install ./sievant-0.2.0-1.x86_64.rpm
```

**Alpine (signed apk).** The apk packages are signed with an RSA key. Install
its public key once, then apk verifies every package without
`--allow-untrusted`:

```sh
wget -O /etc/apk/keys/satyajit.rajaraman@halotrcer.com-sievant.rsa.pub \
  https://raw.githubusercontent.com/rajasatyajit/sievant/main/packaging/keys/satyajit.rajaraman@halotrcer.com-sievant.rsa.pub
apk add ./sievant_0.2.0_x86_64.apk
```

### The apt and yum repositories

From the first release on, the same packages are served from signed
repositories at `https://rajasatyajit.github.io/packages/`, so the system
package manager installs and updates sievant. The repository metadata
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
  sudo tee /etc/apt/sources.list.d/sievant.list
sudo apt update && sudo apt install sievant
```

Fedora, RHEL, Amazon Linux (dnf checks the metadata and every package against
the key, which it offers to import on first use):

```sh
sudo curl -fsSLo /etc/yum.repos.d/sievant.repo https://rajasatyajit.github.io/packages/rpm/sievant.repo
sudo dnf install sievant
```

Every release stays in the repositories, so `apt install sievant=0.2.0` or
`dnf install sievant-0.2.0` pins a version.

### Gateway mode as a service

The packages install `/usr/lib/systemd/system/sievant.service` and leave it
disabled: nothing starts until you configure it. The unit runs
`sievant serve --config /etc/sievant/config.yaml` as a transient
unprivileged user (`DynamicUser`), with no capabilities, a read-only system
(`ProtectSystem=strict`) and its state (a relative `audit.local.path`) in
`/var/lib/sievant`.

```sh
sudo install -d -m 0755 /etc/sievant
sudo sievant init --profile strict --output /etc/sievant/config.yaml   # then set server.transport: http
printf 'SIEVANT_HMAC_KEY=%s\n' "$(openssl rand -hex 32)" | sudo install -m 0600 /dev/stdin /etc/sievant/sievant.env
sudo sievant validate --config /etc/sievant/config.yaml
sudo systemctl enable --now sievant
```

The unit does not start without `/etc/sievant/config.yaml`
(`ConditionPathExists`). `journalctl -u sievant` shows its logs.

## Container image

`ghcr.io/rajasatyajit/sievant` is a distroless, non-root (uid 65532) image for
linux/amd64 and linux/arm64. It runs with a read-only root filesystem; give
the audit database a writable volume. `examples/compose` is a quickstart:
Sievant in front of a sample MCP server, with a self-signed certificate made
on first start (its README has the two setup commands and the calls to try). Each pushed image is cosign-signed by the same
release workflow:

```sh
cosign verify ghcr.io/rajasatyajit/sievant:v0.2.0 \
  --certificate-identity-regexp '^https://github\.com/rajasatyajit/sievant/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

## Kubernetes (Helm)

The chart is an OCI artifact, cosign-signed by the same release workflow,
with a SLSA build provenance attestation:

```sh
cosign verify ghcr.io/rajasatyajit/charts/sievant:0.2.0 \
  --certificate-identity-regexp '^https://github\.com/rajasatyajit/sievant/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
gh attestation verify oci://ghcr.io/rajasatyajit/charts/sievant:0.2.0 --repo rajasatyajit/sievant \
  --signer-workflow rajasatyajit/sievant/.github/workflows/release.yml
helm install sievant oci://ghcr.io/rajasatyajit/charts/sievant --version 0.2.0 \
  --namespace sievant --create-namespace -f values.yaml
```

Its default image is the release's, pinned by digest. Gateway or sidecar
mode, and what each needs: docs/kubernetes.md.

## Build provenance (SLSA)

Every archive, package and SBOM in `checksums.txt`, and the container image,
carries a SLSA v1 build provenance attestation made by the same release
workflow on the version tag. It records which workflow, commit and runner
built the file. Check it with the GitHub CLI:

```sh
gh attestation verify sievant_0.2.0_linux_amd64.tar.gz --repo rajasatyajit/sievant \
  --signer-workflow rajasatyajit/sievant/.github/workflows/release.yml
gh attestation verify oci://ghcr.io/rajasatyajit/sievant:v0.2.0 --repo rajasatyajit/sievant \
  --signer-workflow rajasatyajit/sievant/.github/workflows/release.yml
```

Without access to GitHub's API (an air-gapped host), download the release's
`sievant_<version>_provenance.sigstore.json` beside the archive and add
`--bundle sievant_0.2.0_provenance.sigstore.json` to the first command.

## Air-gapped install

Each release carries one bundle per platform,
`sievant_<version>_airgap_<os>_<arch>.tar.gz`: the platform's archive and
SBOM, on Linux its deb, rpm and apk packages, `checksums.txt`, its cosign
signature bundle and the SLSA provenance bundle, plus a `README.txt`. The
policy packs are compiled into the binary, so nothing else is downloaded.

Carry the bundle across, then check it before installing anything from it.
With a Sievant you already trust (an earlier install, or one verified on a
connected machine):

```sh
sievant verify sievant_0.2.0_airgap_linux_amd64.tar.gz
```

`sievant verify` reads only. Every file must be the one `checksums.txt`
names, byte for byte, and the bundle must hold its platform's release
archive; a file that is not listed is refused. When `cosign` is installed it
first checks `checksums.txt`'s signature (the release workflow's identity, as
above), and a bundle without `checksums.txt.sigstore.json` is then refused
rather than skipped; `--require-cosign` makes cosign mandatory. Exit code 0 means verified,
1 not verified, 2 a usage error; `--json` gives the result as JSON.

**What works offline, and what does not.** The SHA-256 checks need nothing
but the bundle. cosign checks the signature against Sigstore's trusted root,
which it fetches unless it already has it cached, so on a host that has never
been online the signature step may need to run on a connected machine (check
the bundle there, then carry it across). Without cosign, `sievant verify`
says the signature was not checked: the checksums are then only as trustworthy
as the way the bundle arrived.

By hand, without Sievant: `sha256sum --ignore-missing -c checksums.txt` in
the unpacked directory (macOS: `shasum -a 256 --ignore-missing -c
checksums.txt`), after the `cosign verify-blob` command shown in "Homebrew"
above.

## Uninstall

The scripts install one file: delete it (`rm ~/.local/bin/sievant`, or
`/usr/local/bin/sievant` after `--global`; on Windows the `sievant.exe` in the
install directory). Package managers: `brew uninstall --cask sievant`,
`scoop uninstall sievant`, `winget uninstall Halotrcer.Sievant`,
`sudo apt remove sievant`, `sudo dnf remove sievant`, `apk del sievant`.
