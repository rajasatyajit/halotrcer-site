# CLAUDE.md: halotrcer-site

Website for Halotrcer: www.halotrcer.com (main), tokvera.halotrcer.com and sievant.halotrcer.com (product homes). One Astro codebase builds three static sites for three Cloudflare Pages projects. The design is in PLAN.md; the evidence is in research/.

## Product repos are read-only
- Tokvera: ~/workspace/tokvera
- Sievant: ~/workspace/aethergate (repo rajasatyajit/sievant)
- Halotrcer: ~/workspace/halotrcer-installer (repo rajasatyajit/halotrcer)

Other sessions own them. Only read them: no writes, builds or binaries, and no git commands that change state. `git show <ref>:<path>`, `git log` and `git tag -l` are fine.

## Git
- One branch per milestone (`mN-<name>`), one commit per logical change, merge to main when the milestone's gates pass.
- Never push, tag or deploy. The owner pushes.
- After every push the owner makes, check CI for that commit (`gh run list --commit <sha>`) and report it before doing anything else.

## Honesty (non-negotiable)
- No invented customers, logos, testimonials, user counts, star counts, benchmark numbers or savings percentages.
- Every product claim traces to a product repo `file:line`. Numbers and quotes go through `content/claims.yaml` and `<Claim>`; the build-output claim scan fails otherwise.
- Proof sections read `content/proof/*.md` (with `source:` and `permission:`) and render nothing when empty.
- Keep the repos' labels verbatim: Tokvera "Provisional scoring.", Halotrcer "Provisional.", Sievant OWASP "not a compliance certification…".
- Never write "nothing leaves your machine", and never estimate savings for the reader.
- Demo and golden reports are labelled "Simulated demo run", with their source path.
- Example versions in product docs (e.g. 0.2.0) are never shown as released versions.

## Modes
- `LAUNCHED=false` (default): no install commands, versions, GitHub links or star buttons. `<LaunchingSoon>` shows the booking link and the email instead.
- `LAUNCHED=true`: everything renders from `data/releases/*.json` (build-time fetch, or the committed fallback).
- `INSTALL_ENDPOINTS` and `ANALYTICS` are separate flags (PLAN.md §2).
- Both modes are tested in CI. A change that touches install, versions or links must keep the `prelaunch` job green.

## Constants
- Contact: satyajit.rajaraman@halotrcer.com
- Booking: https://www.halotrcer.com/book, a single constant `BOOKING_URL` in `src/config/site.ts`. `/book` redirects there.
- Hostnames come only from `src/config/site.ts`; build cross-host links with `url(host, path)`.

## Front-end rules
- Astro static output, zero JS by default. Vanilla-TS islands only: install picker, copy buttons, calculator, share, theme toggle.
- Every feature works with JavaScript disabled.
- Hand-written CSS with tokens; light and dark themes; no CSS framework.
- System font stack. No web fonts shipped.
- No third-party scripts, fonts or trackers. Cloudflare Web Analytics is the only exception, and only when `ANALYTICS=true`.
- Strict CSP: no inline executable scripts, no `style=` attributes, no `unsafe-inline` or `unsafe-eval`. The only allowed inline script is `application/ld+json`.
- WCAG 2.2 AA, full keyboard support, `prefers-reduced-motion` and `prefers-color-scheme`. Never use colour alone for meaning.
- localStorage access always goes in try/catch.
- Published URLs never break: a moved page gets a 301 in `src/data/redirects.ts`.

## Budgets (CI-enforced)
- Lighthouse 100 in all four categories on key pages (mobile).
- LCP < 1.2 s, CLS 0, INP < 100 ms.
- JS ≤ 20 KB gz per page; page weight ≤ 250 KB excluding a demo video.

## CI
- GitHub Actions pinned by commit SHA, `permissions: contents: read`, `persist-credentials: false`, `ubuntu-24.04`.

## Shared machine
- Tell the owner before anything heavy: Lighthouse runs, full Playwright runs, browser downloads, big npm installs.
- Prefer `npm run budget` and single-test Playwright runs locally.

## Milestone reports
End every milestone with an acceptance table (Lighthouse, budgets, both modes, picker behaviour, no fabricated claims) and the owner's manual steps (DNS, Pages projects, booking link, Search Console). No deploys.
