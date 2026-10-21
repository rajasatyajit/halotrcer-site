---
title: "First run: init, doctor, update, uninstall, completions, the man page"
source:
  repo: tokvera
  path: docs/first-run.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: false
order: 4
---

The commands around installing tokvera (SPEC v0.2 milestone 4). None of them
contacts anything, except `update` and `doctor --check-update`, which read
GitHub (or the `TOKVERA_INSTALL_*` mirror).

## `tokvera init`

```sh
tokvera init            # at most four questions
tokvera init --yes      # no questions: defaults, or the flags given
```

- **What it writes:** the global configuration (docs/config.md), from four
  answers:
  - the scan suite;
  - where scan reports go;
  - the environment variable that holds your endpoint's API key;
  - whether scan reports keep the "Want this fixed?" footer.
- **Answering by flag:** `--suite`, `--out`, `--api-key-env` and `--cta=false`
  each answer one question. `--yes` takes the defaults for the rest.
- **Refusals:**
  - without a terminal, every question must be answered by a flag or `--yes`;
  - an existing file is kept unless `--force`;
  - end of input is not an answer, so nothing is written on a guess.

## `tokvera doctor`

```sh
tokvera doctor [--json] [--check-update]
```

- **What it checks:**
  - the binary: version, commit, commit date, Go version, how it was
    installed, and how to update it;
  - the global configuration;
  - the data directory;
  - the embedded rate sheet's as-of date, and whether it is past the 60 days
    after which `scan` warns;
  - the tools other commands use: docker and its compose plugin (`stack`),
    helm (`stack helm-values`), cosign (`update`), go (`audit`'s full fix-pack
    checks) and `tokvera-cache` (`cache`).
- **Statuses:**
  - `fail`: tokvera cannot work as configured. It is printed with the exact
    command that fixes it, and the exit code is 1.
  - `warn`: an optional tool is missing, with what it is for and where to
    get it.
- **A broken configuration** stops every other command with exit 2; `doctor`
  reports it instead.
- **`--check-update`** asks GitHub for the latest release. It is the only
  check that contacts anything.

## `tokvera update`

```sh
tokvera update [--check] [--version vX.Y.Z] [--require-cosign] [--dry-run]
```

- **What it does, in the install scripts' order:**
  1. resolves the latest release (or `--version`);
  2. downloads `checksums.txt` and verifies its cosign signature against the
     release workflow's identity, when cosign is on PATH (`--require-cosign`
     makes cosign mandatory);
  3. checks the archive's SHA-256 against its line in `checksums.txt`;
  4. runs the new binary once;
  5. renames it over the old one in one step.
- **`tokvera-cache`:** when it sits beside `tokvera`, it is updated from the
  same release.
- **A failure** at any step leaves the old binaries as they were.
- **A package manager's install** (apt, dnf, apk, Homebrew, Scoop, winget,
  `go install`, or the container image) is that manager's to update.
  `update` prints its command, changes nothing, and exits 1.
- **`--dry-run`** prints what would be downloaded and replaced, and
  contacts nothing.

## `tokvera uninstall`

```sh
tokvera uninstall [--yes] [--keep-config] [--keep-data] [--dry-run]
```

- **What it removes,** after listing it and asking: the `tokvera` binary and
  `tokvera-cache` beside it, the global config file, and the data directory.
- **A package manager's binary** is left in place, with that manager's remove
  command printed.
- **The observability stack:** if its files exist, uninstall stops and asks
  for `tokvera stack down --volumes` first, because its Docker volumes are
  not files it could remove.
- **Your own files:** audit bundles and scan reports are never touched.

## Completions and the man page

```sh
source <(tokvera completion bash)
tokvera completion zsh  > "${fpath[1]}/_tokvera"
tokvera completion fish > ~/.config/fish/completions/tokvera.fish
tokvera completion powershell | Out-String | Invoke-Expression
tokvera man > tokvera.1 && man ./tokvera.1
```

- **Where they come from:** tokvera's command table, which a test holds to
  the real flags. The man page is each command's own `--help`.
- **Shipped files:** the release builds them at build time. The deb, rpm and
  apk packages install the man page as `tokvera(1)` and the bash, zsh and
  fish completions where those shells look. The archives carry all four
  scripts and the page.
