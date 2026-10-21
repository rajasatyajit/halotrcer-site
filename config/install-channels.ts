// Where each install channel's commands come from. scripts/sync-releases.ts
// extracts them verbatim (docs) or checks them against the source (literal),
// and writes data/releases/<product>.json. Descriptions cite the doc lines
// they summarise (paths and lines at the commit in config/release-refs.json).

export type ChannelId =
  | 'script'
  | 'powershell'
  | 'brew'
  | 'scoop'
  | 'winget'
  | 'apt'
  | 'dnf'
  | 'apk'
  | 'docker'
  | 'helm'
  | 'go'
  | 'releases'
  | 'airgap';

export type Os = 'macos' | 'linux' | 'windows';

// apkArch: x86_64 | aarch64. platform: <goos>_<goarch>, e.g. linux_amd64, darwin_arm64.
export type ArchPlaceholder = 'apkArch' | 'platform';

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  script: 'Install script',
  powershell: 'PowerShell',
  brew: 'Homebrew',
  scoop: 'Scoop',
  winget: 'winget',
  apt: 'apt',
  dnf: 'dnf / yum',
  apk: 'apk',
  docker: 'Docker',
  helm: 'Helm',
  go: 'go install',
  releases: 'GitHub Releases',
  airgap: 'Air-gapped',
};

export const CHANNEL_ORDER = Object.keys(CHANNEL_LABELS) as ChannelId[];

export type Source =
  // inline code span in a doc, e.g. the quick-start table
  | { kind: 'inline'; file?: string; startsWith: string }
  // code block `index` under `heading`; optional command filters
  | { kind: 'block'; file?: string; heading: string; index: number; from?: RegExp; keep?: RegExp }
  // commands written here, each checked to appear in `file` (for repos with no install doc yet)
  | { kind: 'literal'; file: string; commands: string[]; mustContain: string[] };

export interface ChannelSpec {
  id: ChannelId;
  os: Os[] | 'any';
  source?: Source; // absent: a link-only channel (GitHub Releases)
  // literal token in the documented command -> placeholder resolved per platform
  arch?: Record<string, ArchPlaceholder>;
  what: string;
  whatCite: string;
  verify?: { text: string; cite: string; source?: Source };
}

export interface ProductSpec {
  repo: 'tokvera' | 'sievant' | 'halotrcer';
  name: string;
  binary: string;
  docs?: string; // the install doc commands are extracted from
  exampleVersion: string; // the version the docs use as an example
  next: { cmd: string; note?: string; cite: string }[];
  channels: ChannelSpec[];
}

const SCRIPT_WHAT = (bin: string) =>
  `Downloads the latest release from GitHub, checks its SHA-256 (and its cosign signature when cosign is installed), and installs ${bin} into ~/.local/bin. Run it again to upgrade.`;

const COSIGN_TEXT =
  'Check that checksums.txt was signed by the repository’s release workflow on a version tag, then compare your download’s SHA-256 with its line in checksums.txt.';

const REPO_SIGNED = (cite: string) => ({
  text: 'The repository metadata and every package are signed with the OpenPGP key halotrcer-packages.asc (fingerprint D2D9 6618 831A C55B 81E2 4DA3 039B 5DA0 D3E3 9071).',
  cite,
});

function docsProduct(repo: 'tokvera' | 'sievant', name: string): ChannelSpec[] {
  const host = `${repo}.halotrcer.com`;
  const cosignBlock: Source = { kind: 'block', heading: 'Homebrew (macOS)', index: 1 };
  const cosign = {
    text: COSIGN_TEXT,
    cite: 'docs/install.md "Homebrew (macOS)"',
    source: cosignBlock,
  };
  return [
    {
      id: 'script',
      os: ['macos', 'linux'],
      source: { kind: 'inline', startsWith: `curl -fsSL https://${host}/install.sh` },
      what: SCRIPT_WHAT(repo),
      whatCite: 'docs/install.md "The install scripts"',
      verify: {
        text: 'The script verifies the release before installing anything. To check the script itself, compare its SHA-256 with the one published on the install page.',
        cite: 'docs/install.md "The install scripts" step 5',
      },
    },
    {
      id: 'powershell',
      os: ['windows'],
      source: { kind: 'inline', startsWith: `irm https://${host}/install.ps1` },
      what: `The same steps on Windows PowerShell 5.1 or PowerShell 7; installs ${repo}.exe into your user profile.`,
      whatCite: 'docs/install.md "install.ps1 (Windows)"',
      verify: {
        text: 'The script verifies the release before installing anything. To check the script itself, compare its SHA-256 with the one published on the install page.',
        cite: 'docs/install.md "The install scripts" step 5',
      },
    },
    {
      id: 'brew',
      os: ['macos'],
      source: { kind: 'block', heading: 'Homebrew (macOS)', index: 0 },
      what: `Installs the ${name} cask from the rajasatyajit tap. The macOS binary is not notarized by Apple: the guarantee is the checksum and the cosign signature.`,
      whatCite: 'docs/install.md "Homebrew (macOS)"',
      verify: cosign,
    },
    {
      id: 'scoop',
      os: ['windows'],
      source: { kind: 'block', heading: 'Scoop and winget (Windows)', index: 0, keep: /^scoop / },
      what: 'Adds the rajasatyajit bucket, then installs.',
      whatCite: 'docs/install.md "Scoop and winget (Windows)"',
      verify: cosign,
    },
    {
      id: 'winget',
      os: ['windows'],
      source: { kind: 'block', heading: 'Scoop and winget (Windows)', index: 0, keep: /^winget / },
      what: 'Installs from the winget community repository, which can show a new version later than GitHub while Microsoft reviews it.',
      whatCite: 'docs/install.md "Scoop and winget (Windows)"',
      verify: cosign,
    },
    {
      id: 'apt',
      os: ['linux'],
      source: { kind: 'block', heading: 'The apt and yum repositories', index: 0 },
      what: `Adds the signed apt repository, so apt installs and updates ${repo}.`,
      whatCite: 'docs/install.md "The apt and yum repositories"',
      verify: REPO_SIGNED('docs/install.md "The apt and yum repositories"'),
    },
    {
      id: 'dnf',
      os: ['linux'],
      source: { kind: 'block', heading: 'The apt and yum repositories', index: 1 },
      what: 'Adds the signed yum repository for Fedora, RHEL and Amazon Linux; dnf offers to import the key on first use.',
      whatCite: 'docs/install.md "The apt and yum repositories"',
      verify: REPO_SIGNED('docs/install.md "The apt and yum repositories"'),
    },
    {
      id: 'apk',
      os: ['linux'],
      source: { kind: 'block', heading: 'Linux packages', index: 1 },
      arch: { x86_64: 'apkArch' },
      what: 'Installs the apk signing key once, then a signed package from the release (Alpine).',
      whatCite: 'docs/install.md "Alpine (signed apk)"',
      verify: {
        text: 'With the key installed, apk verifies the package without --allow-untrusted.',
        cite: 'docs/install.md "Alpine (signed apk)"',
      },
    },
    {
      id: 'docker',
      os: 'any',
      source: { kind: 'inline', startsWith: `docker run --rm ghcr.io/rajasatyajit/${repo}` },
      what: 'Runs the distroless, non-root image for linux/amd64 and linux/arm64.',
      whatCite: 'docs/install.md "Container image"',
      verify: {
        text: 'Each image is cosign-signed by the same release workflow.',
        cite: 'docs/install.md "Container image"',
        source: { kind: 'block', heading: 'Container image', index: 0 },
      },
    },
    {
      id: 'go',
      os: 'any',
      source: { kind: 'inline', startsWith: `go install github.com/rajasatyajit/${repo}` },
      what: 'Builds from source with Go.',
      whatCite: 'docs/install.md quick-start table',
    },
    {
      id: 'releases',
      os: 'any',
      what: 'Download the archive for your platform and checksums.txt from the release page.',
      whatCite: 'docs/install.md introduction',
      verify: cosign,
    },
  ];
}

export const PRODUCTS: Record<'tokvera' | 'sievant' | 'halotrcer', ProductSpec> = {
  tokvera: {
    repo: 'tokvera',
    name: 'Tokvera',
    binary: 'tokvera',
    docs: 'docs/install.md',
    exampleVersion: '0.2.0',
    next: [
      { cmd: 'tokvera scan --demo', note: 'no endpoint needed', cite: 'cmd/tokvera/init.go:171' },
      { cmd: 'tokvera scan --target URL', cite: 'cmd/tokvera/init.go:171' },
    ],
    channels: [
      ...docsProduct('tokvera', 'Tokvera'),
      {
        id: 'helm',
        os: 'any',
        source: {
          kind: 'block',
          file: 'docs/helm.md',
          heading: 'Helm chart: a scheduled scan',
          index: 0,
        },
        what: 'Runs tokvera scan on a schedule inside a Kubernetes cluster and keeps the latest report.',
        whatCite: 'docs/helm.md introduction',
      },
    ],
  },
  sievant: {
    repo: 'sievant',
    name: 'Sievant',
    binary: 'sievant',
    docs: 'docs/install.md',
    exampleVersion: '0.2.0',
    next: [
      {
        cmd: 'sievant scan',
        note: 'read-only audit of the MCP client configurations on this machine',
        cite: 'scripts/install.sh:340',
      },
      {
        cmd: 'sievant wrap --all',
        note: 'route those MCP servers through Sievant; sievant unwrap restores them',
        cite: 'scripts/install.sh:341',
      },
    ],
    channels: [
      ...docsProduct('sievant', 'Sievant'),
      {
        id: 'helm',
        os: 'any',
        source: { kind: 'block', heading: 'Kubernetes (Helm)', index: 0, from: /^helm install/ },
        what: 'Installs the chart into Kubernetes, for gateway or sidecar mode. Its default image is the release’s, pinned by digest.',
        whatCite: 'docs/install.md "Kubernetes (Helm)"',
        verify: {
          text: 'The chart is cosign-signed by the release workflow and carries a SLSA build provenance attestation.',
          cite: 'docs/install.md "Kubernetes (Helm)"',
          source: { kind: 'block', heading: 'Kubernetes (Helm)', index: 0, keep: /^(cosign|gh) / },
        },
      },
      {
        id: 'airgap',
        os: ['linux', 'macos', 'windows'],
        source: { kind: 'block', heading: 'Air-gapped install', index: 0 },
        arch: { linux_amd64: 'platform' },
        what: 'One bundle per platform with the archive, SBOM, packages, checksums and signatures. Carry it across, then check it with a Sievant you already trust before installing.',
        whatCite: 'docs/install.md "Air-gapped install"',
        verify: {
          text: 'sievant verify reads only: every file must be the one checksums.txt names, byte for byte, and with cosign installed it checks the signature first.',
          cite: 'docs/install.md "Air-gapped install"',
        },
      },
    ],
  },
  halotrcer: {
    repo: 'halotrcer',
    name: 'Halotrcer',
    binary: 'halotrcer',
    // No docs/install.md yet: commands are the ones internal/install/channels.go
    // builds for the halotrcer tool, checked against that file.
    exampleVersion: '0.2.0',
    next: [
      { cmd: 'halotrcer check --target <inference-url>', cite: 'cmd/halotrcer/install.go:94' },
    ],
    channels: [
      {
        id: 'brew',
        os: ['macos'],
        source: {
          kind: 'literal',
          file: 'internal/install/channels.go',
          commands: ['brew install --cask rajasatyajit/tap/halotrcer'],
          mustContain: ['"brew", "install", "--cask", "rajasatyajit/tap/" + t.Name'],
        },
        what: 'Installs the Halotrcer cask from the rajasatyajit tap.',
        whatCite: 'internal/install/channels.go:88',
      },
      {
        id: 'scoop',
        os: ['windows'],
        source: {
          kind: 'literal',
          file: 'internal/install/channels.go',
          commands: [
            'scoop bucket add rajasatyajit https://github.com/rajasatyajit/scoop-bucket',
            'scoop install rajasatyajit/halotrcer',
          ],
          mustContain: [
            'ScoopBucketURL  = "https://github.com/rajasatyajit/scoop-bucket"',
            '"scoop", "install", ScoopBucketName + "/" + t.Name',
          ],
        },
        what: 'Adds the rajasatyajit bucket, then installs.',
        whatCite: 'internal/install/channels.go:78-90',
      },
      {
        id: 'winget',
        os: ['windows'],
        source: {
          kind: 'literal',
          file: 'internal/install/channels.go',
          commands: ['winget install -e --id Halotrcer.Halotrcer'],
          mustContain: [
            'WingetID: "Halotrcer.Halotrcer"',
            '"winget", "install", "-e", "--id", t.WingetID',
          ],
        },
        what: 'Installs from the winget community repository.',
        whatCite: 'internal/install/channels.go:30,92',
      },
      {
        id: 'apt',
        os: ['linux'],
        source: {
          kind: 'literal',
          file: 'internal/install/channels.go',
          commands: [
            'sudo install -d -m 0755 /etc/apt/keyrings',
            'sudo curl -fsSLo /etc/apt/keyrings/halotrcer-packages.asc https://rajasatyajit.github.io/packages/halotrcer-packages.asc',
            'echo "deb [signed-by=/etc/apt/keyrings/halotrcer-packages.asc] https://rajasatyajit.github.io/packages/apt stable main" | sudo tee /etc/apt/sources.list.d/halotrcer.list',
            'sudo apt update && sudo apt install halotrcer',
          ],
          mustContain: [
            'PackagesBase  = "https://rajasatyajit.github.io/packages"',
            '"sudo apt update && sudo apt install "+t.Name',
          ],
        },
        what: 'Adds the signed apt repository, so apt installs and updates halotrcer.',
        whatCite: 'internal/install/channels.go:129-154',
        verify: REPO_SIGNED(
          'tokvera docs/install.md "The apt and yum repositories" (shared repository)',
        ),
      },
      {
        id: 'dnf',
        os: ['linux'],
        source: {
          kind: 'literal',
          file: 'internal/install/channels.go',
          commands: [
            'sudo curl -fsSLo /etc/yum.repos.d/halotrcer.repo https://rajasatyajit.github.io/packages/rpm/halotrcer.repo',
            'sudo dnf install halotrcer',
          ],
          mustContain: ['"/rpm/" + t.Name + ".repo"', '"sudo dnf install " + t.Name'],
        },
        what: 'Adds the signed yum repository for Fedora, RHEL and Amazon Linux.',
        whatCite: 'internal/install/channels.go:155-162',
        verify: REPO_SIGNED(
          'tokvera docs/install.md "The apt and yum repositories" (shared repository)',
        ),
      },
      {
        id: 'apk',
        os: ['linux'],
        source: {
          kind: 'literal',
          file: 'internal/install/channels.go',
          commands: [
            'wget -O /etc/apk/keys/satyajit.rajaraman@halotrcer.com-halotrcer.rsa.pub https://raw.githubusercontent.com/rajasatyajit/halotrcer/main/packaging/keys/satyajit.rajaraman@halotrcer.com-halotrcer.rsa.pub',
            'wget https://github.com/rajasatyajit/halotrcer/releases/download/v0.2.0/halotrcer_0.2.0_x86_64.apk',
            'apk add ./halotrcer_0.2.0_x86_64.apk',
          ],
          mustContain: ['"%s_%s_%s.apk"', '"apk add ./" + file'],
        },
        arch: { x86_64: 'apkArch' },
        what: 'Installs the apk signing key once, then a signed package from the release (Alpine).',
        whatCite: 'internal/install/channels.go:163-171',
      },
      {
        id: 'go',
        os: 'any',
        source: {
          kind: 'literal',
          file: 'internal/install/channels.go',
          commands: ['go install github.com/rajasatyajit/halotrcer/cmd/halotrcer@latest'],
          mustContain: ['"github.com/rajasatyajit/" + t.Repo + "/cmd/" + t.Name', 'v := "latest"'],
        },
        what: 'Builds from source with Go.',
        whatCite: 'internal/install/channels.go:54-57,93-98',
      },
      {
        id: 'releases',
        os: 'any',
        what: 'Download the archive for your platform and checksums.txt from the release page.',
        whatCite: 'internal/install/direct.go:26-33',
      },
    ],
  },
};
