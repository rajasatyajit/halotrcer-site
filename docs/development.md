# Development

See the README for commands and PLAN.md for the design.

## CI runners

Every Linux job runs on
`${{ github.event.repository.private && vars.LINUX_RUNNER || 'ubuntu-24.04' }}`,
the same expression as the product repositories:

- **`LINUX_RUNNER` unset:** jobs use GitHub's hosted `ubuntu-24.04` runner.
- **Set** (Settings → Secrets and variables → Actions → Variables) to the label
  of the owner's self-hosted runner, e.g. `self-hosted`: jobs run there. This
  is for a private repository whose Actions minutes have run out.
- **Only while the repository is private.** A public repository runs on
  GitHub-hosted runners even if the variable is left behind.
- **Delete the variable when the repository goes public** anyway, so the
  settings say what actually happens. **Never use a self-hosted runner on a
  public repository:** a pull request from a fork could run its own code on
  the owner's machine.

`tests/unit/runner.test.ts` pins the expression on every job, and the tools
check below.

## What a self-hosted runner needs

The owner's runner is an Ubuntu 24.04 userland (distrobox) with passwordless
`sudo`. Each job installs its own Node (`setup-node`, from `.nvmrc`), npm
packages (`npm ci`) and, where needed, Chromium
(`npx playwright install --with-deps chromium`, which installs Chromium's
system libraries with `sudo apt-get`; Lighthouse is pointed at that Chromium
with `CHROME_PATH`). On `main` and on manual runs, `e2e-browsers` installs
Firefox and WebKit the same way (`npx playwright install --with-deps firefox`
or `webkit`; WebKit's system libraries need Ubuntu or Debian). The rest comes
from the host. GitHub's `ubuntu-24.04`
image has all of it; on a self-hosted runner each job first runs
`scripts/ci/runner-tools.sh`, right after checkout, which fails naming
anything missing.

`verify`, `build` and `cross-host`:

```
git tar gzip
```

`e2e`, `e2e-browsers` and `lighthouse`:

```
git tar gzip sudo sudo-nopasswd apt-get
```

`sudo-nopasswd` means `sudo -n true` succeeds for the runner's user.

On Ubuntu 24.04 these come from the packages `git tar gzip sudo apt`, and a
sudoers entry giving the runner's user passwordless sudo.

### Other assumptions

| Assumption                                             | Why it matters                                                                                                                          | What to do                                                                 |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Debian or Ubuntu (24.04 here) with passwordless `sudo` | `playwright install --with-deps` uses `sudo apt-get`                                                                                    | Holds for the owner's distrobox; `runner-tools.sh` checks it               |
| x64 or arm64 Linux                                     | Playwright ships Chromium for these only                                                                                                | Use one of them                                                            |
| Outbound HTTPS                                         | `setup-node` downloads Node; `npm ci` reaches the npm registry; Playwright downloads Chromium                                           | Allow nodejs.org, github.com, registry.npmjs.org and Playwright's CDN      |
| A writable tool cache                                  | `setup-node` keeps Node in `RUNNER_TOOL_CACHE`                                                                                          | The default runner install provides one                                    |
| Ports 4321–4323 free                                   | The e2e job's static server (`scripts/serve.ts`) listens on them                                                                        | One runner per machine, or don't run two e2e jobs at once on the same host |
| Not running as root                                    | Chromium refuses to start with its sandbox as root; Lighthouse already passes `--no-sandbox`                                            | Run the runner as an unprivileged user                                     |
| Disk space                                             | Chromium (about 300 MB in `~/.cache/ms-playwright`; Firefox and WebKit add about 300 MB on `main`) and npm's cache persist between jobs | Budget about 2 GB                                                          |
| Clean workspaces                                       | `actions/checkout` cleans the workspace by default; `dist/` and `.cache/` are untracked, so they are removed                            | Keep the default                                                           |

Nothing in the workflow needs a secret, Docker or a GPU.
