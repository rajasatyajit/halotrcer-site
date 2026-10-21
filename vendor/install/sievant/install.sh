#!/bin/sh
# Sievant installer for Linux and macOS.
#
#   curl -fsSL https://sievant.halotrcer.com/install.sh | sh
#   curl -fsSL https://sievant.halotrcer.com/install.sh | sh -s -- --version v0.2.0 --dir /opt/bin
#
# What it does, in order (every step is commented below):
#   1. detects the OS and CPU (Apple Silicon under Rosetta gets the native
#      arm64 build; musl and glibc Linux get the same static binary);
#   2. resolves the version (the latest published release unless --version);
#   3. stops if that version is already installed (safe to run again);
#   4. downloads the release archive and checksums.txt from GitHub;
#   5. verifies checksums.txt's cosign signature when cosign is installed
#      (required with --require-cosign), then the archive's SHA-256;
#   6. installs the binary atomically, then prints a PATH hint if needed and
#      the next steps (sievant scan, then sievant wrap --all).
#
# It contacts only GitHub (api.github.com to resolve "latest", github.com for
# the release files), never asks for credentials, and with --dry-run contacts
# nothing at all. POSIX sh; shellcheck-clean. Source and docs:
# https://github.com/rajasatyajit/sievant (docs/install.md).
#
# Exit codes: 0 installed (or already installed, or dry run), 1 failure,
# 2 usage error.

set -eu

# --- Constants --------------------------------------------------------------

REPO="rajasatyajit/sievant"
# The release files and the GitHub API. Overridable for a mirror or a test
# server; an override must be https, or plain http to a loopback host only.
DOWNLOAD_BASE="${SIEVANT_INSTALL_DOWNLOAD_BASE:-https://github.com/$REPO/releases/download}"
API_BASE="${SIEVANT_INSTALL_API_BASE:-https://api.github.com/repos/$REPO}"
# The identity cosign must see on the checksum file's signature: the release
# workflow of this repository, running on a version tag.
COSIGN_IDENTITY_REGEXP='^https://github\.com/rajasatyajit/sievant/\.github/workflows/release\.yml@refs/tags/v'
COSIGN_OIDC_ISSUER='https://token.actions.githubusercontent.com'

# --- Messages ---------------------------------------------------------------

# Progress goes to stderr, so `sh install.sh 2>/dev/null` is quiet.
say() { printf 'sievant-install: %s\n' "$*" >&2; }
fail() { say "error: $*"; exit 1; }
usage_error() { say "error: $*"; say "run with --help for usage"; exit 2; }

usage() {
	cat <<'EOF'
Install sievant (https://github.com/rajasatyajit/sievant).

usage: install.sh [options]

  --version VERSION   install this release (e.g. v0.2.0); default: the latest
  --dir DIR           install into DIR (default: $HOME/.local/bin)
  --global            install into /usr/local/bin (uses sudo when needed)
  --dry-run           print what would happen; download and change nothing
  --no-verify         skip the SHA-256 and signature checks (not recommended)
  --require-cosign    fail unless cosign is installed and the signature verifies
  -h, --help          show this help

Exit codes: 0 installed, already installed or dry run; 1 failure; 2 usage.
EOF
}

# --- Step 0: read the options -------------------------------------------------

version=""
dir=""
global=0
dry_run=0
verify=1
require_cosign=0

while [ $# -gt 0 ]; do
	case "$1" in
	--version) [ $# -ge 2 ] || usage_error "--version needs a value"; version="$2"; shift 2 ;;
	--version=*) version="${1#--version=}"; shift ;;
	--dir) [ $# -ge 2 ] || usage_error "--dir needs a value"; dir="$2"; shift 2 ;;
	--dir=*) dir="${1#--dir=}"; shift ;;
	--global) global=1; shift ;;
	--dry-run) dry_run=1; shift ;;
	--no-verify) verify=0; shift ;;
	--require-cosign) require_cosign=1; shift ;;
	-h | --help) usage; exit 0 ;;
	*) usage_error "unknown option: $1" ;;
	esac
done

# Contradictory or malformed options are refused before anything else runs.
if [ "$global" -eq 1 ] && [ -n "$dir" ]; then
	usage_error "--dir and --global are mutually exclusive"
fi
if [ "$verify" -eq 0 ] && [ "$require_cosign" -eq 1 ]; then
	usage_error "--no-verify and --require-cosign are mutually exclusive"
fi
if [ -n "$version" ]; then
	# Accept "0.2.0" as well as "v0.2.0"; the release tags carry the v.
	case "$version" in v*) ;; *) version="v$version" ;; esac
	# A strict pattern keeps the value safe to put in a URL and a file name.
	if ! printf '%s\n' "$version" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
		usage_error "--version must look like v1.2.3 or v1.2.3-rc.1, got: $version"
	fi
fi

# An overridden endpoint must not send the download in the clear to another
# machine: https, or http to this machine only.
check_endpoint() {
	case "$1" in
	https://*) ;;
	http://127.0.0.1:* | http://127.0.0.1/* | http://localhost:* | http://localhost/* | "http://[::1]:"* | "http://[::1]/"*) ;;
	*) usage_error "$2 must be an https URL (or http to a loopback host), got: $1" ;;
	esac
}
check_endpoint "$DOWNLOAD_BASE" SIEVANT_INSTALL_DOWNLOAD_BASE
check_endpoint "$API_BASE" SIEVANT_INSTALL_API_BASE

# --- Step 1: detect the platform ----------------------------------------------

# The OS. Windows shells (Git Bash, MSYS2, Cygwin) are pointed at install.ps1.
case "$(uname -s)" in
Linux) os=linux ;;
Darwin) os=darwin ;;
MINGW* | MSYS* | CYGWIN*) fail "this is the Linux/macOS installer; on Windows use install.ps1 (see docs/install.md)" ;;
*) fail "unsupported OS: $(uname -s) (release builds exist for Linux, macOS and Windows)" ;;
esac

# The CPU. Release builds exist for amd64 and arm64 only.
case "$(uname -m)" in
x86_64 | amd64) arch=amd64 ;;
aarch64 | arm64) arch=arm64 ;;
*) fail "unsupported CPU: $(uname -m) (release builds exist for amd64 and arm64)" ;;
esac

# Apple Silicon running this shell under Rosetta 2 reports x86_64; the native
# arm64 build is the right one there. sysctl.proc_translated is 1 only inside
# a translated process (and absent on Intel Macs).
if [ "$os" = darwin ] && [ "$arch" = amd64 ]; then
	if [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then
		arch=arm64
		say "Rosetta 2 detected: installing the native arm64 build"
	fi
fi

# musl (Alpine and friends) needs nothing different: the release binary is
# statically linked (CGO_ENABLED=0), so the same archive runs on glibc and musl.
if [ "$os" = linux ]; then
	if ldd --version 2>&1 | grep -qi musl || ls /lib/ld-musl-* >/dev/null 2>&1; then
		say "musl libc detected: the release binary is static, so the standard Linux build runs as is"
	fi
fi

# --- Step 2: choose the destination -------------------------------------------

if [ "$global" -eq 1 ]; then
	dir=/usr/local/bin
elif [ -z "$dir" ]; then
	[ -n "${HOME:-}" ] || fail "HOME is not set; pass --dir"
	dir="$HOME/.local/bin"
fi

# --- Dry run: print the plan, contact nothing --------------------------------

if [ "$dry_run" -eq 1 ]; then
	if [ -n "$version" ]; then
		shown="$version"
		archive="sievant_${version#v}_${os}_${arch}.tar.gz"
	else
		shown="latest (resolved from $API_BASE/releases/latest at install time)"
		archive="sievant_<version>_${os}_${arch}.tar.gz"
	fi
	say "dry run: nothing will be downloaded or changed"
	say "platform:     ${os}/${arch}"
	say "version:      $shown"
	say "archive:      $DOWNLOAD_BASE/<tag>/$archive"
	if [ "$verify" -eq 1 ]; then
		say "verify:       SHA-256 against checksums.txt; cosign signature of checksums.txt if cosign is installed$([ "$require_cosign" -eq 1 ] && printf ' (required)')"
	else
		say "verify:       SKIPPED (--no-verify)"
	fi
	say "install to:   $dir/sievant"
	exit 0
fi

# --- Step 3: check the tools this script needs ---------------------------------

have() { command -v "$1" >/dev/null 2>&1; }

# A downloader: curl, or wget when curl is missing.
if have curl; then
	downloader=curl
elif have wget; then
	downloader=wget
else
	fail "need curl or wget to download the release"
fi
for tool in tar mktemp; do
	have "$tool" || fail "need $tool"
done

# A SHA-256 tool: sha256sum (GNU, busybox), shasum (macOS) or openssl.
sha256_of() {
	if have sha256sum; then
		sha256sum "$1" | awk '{print $1}'
	elif have shasum; then
		shasum -a 256 "$1" | awk '{print $1}'
	elif have openssl; then
		openssl dgst -sha256 "$1" | awk '{print $NF}'
	else
		return 1
	fi
}
if [ "$verify" -eq 1 ] && ! have sha256sum && ! have shasum && ! have openssl; then
	fail "need sha256sum, shasum or openssl to verify the download (or pass --no-verify, not recommended)"
fi

# cosign is optional unless --require-cosign; checked now, before downloading.
use_cosign=0
if [ "$verify" -eq 1 ]; then
	if have cosign; then
		use_cosign=1
	elif [ "$require_cosign" -eq 1 ]; then
		fail "--require-cosign: cosign is not installed (https://docs.sigstore.dev/cosign/system_config/installation/)"
	fi
fi

# download URL FILE: https only (curl also refuses an http redirect); plain http
# is reachable only through a loopback override, which check_endpoint allowed.
download() {
	case "$1" in
	https://*) proto='=https' ;;
	*) proto='=http' ;;
	esac
	if [ "$downloader" = curl ]; then
		curl -fsSL --proto "$proto" --proto-redir "$proto" -o "$2" "$1"
	else
		wget -q -O "$2" "$1"
	fi
}

# --- Step 4: resolve the version -----------------------------------------------

# A scratch directory for everything downloaded; removed on every exit path.
tmp="$(mktemp -d 2>/dev/null || mktemp -d -t sievant)"
trap 'rm -rf "$tmp"' EXIT
trap 'exit 1' HUP INT TERM

if [ -z "$version" ]; then
	# The latest PUBLISHED release (drafts are not visible here).
	download "$API_BASE/releases/latest" "$tmp/latest.json" ||
		fail "could not find the latest release at $API_BASE/releases/latest; pass --version"
	version="$(sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$tmp/latest.json" | head -n 1)"
	if ! printf '%s\n' "$version" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
		fail "the latest release has an unexpected tag ($version); pass --version"
	fi
fi
say "installing sievant $version for ${os}/${arch} into $dir"

# --- Step 5: stop if this version is already installed (idempotent) -----------

# `sievant version` prints "sievant vX.Y.Z" on stderr (its v0.1.0 format).
if [ -x "$dir/sievant" ]; then
	installed="$("$dir/sievant" version 2>&1 | head -n 1 || true)"
	case "$installed" in
	"sievant $version "* | "sievant $version")
		say "sievant $version is already installed at $dir/sievant; nothing to do"
		exit 0
		;;
	esac
fi

# --- Step 6: download the archive and the checksum file -------------------------

archive="sievant_${version#v}_${os}_${arch}.tar.gz"
base="$DOWNLOAD_BASE/$version"
say "downloading $base/$archive"
download "$base/$archive" "$tmp/$archive" || fail "download failed: $base/$archive"

# --- Step 7: verify the signature, then the checksum ---------------------------

if [ "$verify" -eq 1 ]; then
	download "$base/checksums.txt" "$tmp/checksums.txt" || fail "download failed: $base/checksums.txt"

	# The signature first: it is what makes the checksum file trustworthy.
	if [ "$use_cosign" -eq 1 ]; then
		download "$base/checksums.txt.sigstore.json" "$tmp/checksums.txt.sigstore.json" ||
			fail "download failed: $base/checksums.txt.sigstore.json"
		if ! cosign verify-blob --bundle "$tmp/checksums.txt.sigstore.json" \
			--certificate-identity-regexp "$COSIGN_IDENTITY_REGEXP" \
			--certificate-oidc-issuer "$COSIGN_OIDC_ISSUER" \
			"$tmp/checksums.txt" >/dev/null 2>&1; then
			fail "cosign could not verify checksums.txt as signed by $REPO's release workflow; nothing was installed"
		fi
		say "cosign: checksums.txt is signed by $REPO's release workflow"
	else
		say "cosign not found: the signature was not checked (SHA-256 only; install cosign or pass --require-cosign)"
	fi

	# Then the archive's SHA-256 against its exact line in checksums.txt.
	want="$(awk -v f="$archive" '$2 == f {print $1}' "$tmp/checksums.txt")"
	[ -n "$want" ] || fail "$archive is not listed in checksums.txt; nothing was installed"
	got="$(sha256_of "$tmp/$archive")" || fail "could not compute the SHA-256 of $archive"
	[ "$got" = "$want" ] || fail "SHA-256 mismatch for $archive (expected $want, got $got); nothing was installed"
	say "SHA-256 verified"
else
	say "WARNING: --no-verify: the download's SHA-256 and signature were NOT checked"
fi

# --- Step 8: unpack and check the binary runs ------------------------------------

tar -xzf "$tmp/$archive" -C "$tmp" sievant || fail "could not unpack sievant from $archive"
chmod 0755 "$tmp/sievant"
"$tmp/sievant" version >/dev/null 2>&1 || fail "the downloaded binary does not run on this machine"

# --- Step 9: install atomically ---------------------------------------------------

# Write next to the destination, then rename over it: an interrupted install
# never leaves a half-written sievant behind. sudo only when the directory is
# not writable, and the command is printed first.
sudo_cmd=""
if ! mkdir -p "$dir" 2>/dev/null || [ ! -w "$dir" ]; then
	have sudo || fail "$dir is not writable and sudo is not available; pass --dir to a directory you own"
	sudo_cmd="sudo"
	say "$dir is not writable; using sudo"
fi
$sudo_cmd mkdir -p "$dir"
$sudo_cmd cp "$tmp/sievant" "$dir/.sievant.new.$$"
$sudo_cmd chmod 0755 "$dir/.sievant.new.$$"
$sudo_cmd mv -f "$dir/.sievant.new.$$" "$dir/sievant"
say "installed: $("$dir/sievant" version 2>&1 | head -n 1)"

# --- Step 10: PATH hint -------------------------------------------------------------

case ":${PATH:-}:" in
*":$dir:"*) ;;
*) say "$dir is not on your PATH; add it, for example: export PATH=\"$dir:\$PATH\"" ;;
esac

# --- Step 11: next steps ------------------------------------------------------------

say "next: sievant scan        (read-only audit of the MCP client configurations on this machine)"
say "then: sievant wrap --all  (route those MCP servers through Sievant; sievant unwrap restores them)"
