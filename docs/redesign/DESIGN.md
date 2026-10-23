# DESIGN.md: "The AI Case File" (owner-approved direction, 2026-10-23)

Reference page: `docs/redesign/reference/case-file.html` (the approved mockup, design 6C).
Build from this spec, not by copying the mockup's markup: the mockup uses Google Fonts,
inline styles and an inline script, which the site's CSP and gates forbid.

## 1. Concept

The site is a detective's cork board. Findings from the tools are pinned up as clue
cards (suspects, evidence, accomplices, alibis, things caught), joined by red yarn to
the thing under investigation. Halotrcer, Tokvera and Sievant are "the detectives".
The visitor's question is the case: "Is your AI slow, expensive or leaking?"

Tone: playful in the headings and labels, plain and exact in every sentence that
states a fact. The joke lives in the framing words (Suspect, Alibi, Hire the
detectives); numbers and claims stay as sober and sourced as today.

## 2. Colour tokens

| Token | Value | Role |
|---|---|---|
| `--frame` | `#3B2A1A` | page background around the board (dark wood) |
| `--frame-edge` | `#5A3D22` | the board's wooden border |
| `--cork` | `#B98A55` | board surface |
| `--cork-dot` | `#A2763F` | cork texture dots (CSS radial gradients, no image) |
| `--card` | `#FFFDF6` | clue cards, paper sections |
| `--ink` | `#1F1A14` | text on cards and paper |
| `--faded` | `#5E544A` | secondary text on paper (passes 4.5:1 on `--card`) |
| `--yarn` | `#C1121F` | red yarn, "kind" labels, primary button |
| `--pin` | `#D62828` | pin heads |
| `--sticky` | `#FFE45C` | sticky notes, accent text on dark |
| `--tag` | `#F7F2E2` | case tag card |
| `--on-frame` | `#FFFDF6` / muted `#E6D9C6` | text on the wood |

Themes: the board is an object and looks the same in light and dark. Light theme:
paper sections use `--card` with `--ink`. Dark theme: paper sections switch to a
dark paper (`#1F1A14` with `#F3EBDD` text, `--sticky` accents); the wood and cork stay.
Run `tests/unit/contrast.test.ts` on every pair, both themes.

## 3. Typography

Revised by the owner on 2026-10-23 (LCP budget, measured that day; the runs are in
`docs/fonts.md`).

| Role | Face | Use |
|---|---|---|
| Display | Permanent Marker, trimmed subset (printable ASCII plus the copy's punctuation), not preloaded | headings, card titles, "kind" labels, prices. Never body text |
| Typewriter | system monospace (`Courier New`, `Liberation Mono`, …), ink colour from the tokens, slight letter spacing | card body text, case tags, stamps, small print |
| Body | system UI fonts | paragraphs, navigation, buttons, forms |

- Marker for the www headline and all board furniture; product-site headlines use the bold body face (long sentences, and it keeps LCP at first paint). (Owner decision 2026-10-23: in Marker, the Sievant headline was the LCP element and measured 1.36 s median.)
- Reason: on Lighthouse's simulated mobile connection every font on the first screen
  delays the first paint. All three faces gave a 1.81 s LCP; Marker alone, not
  preloaded, gave a 1.21 s median (100 ×4). Preloading Marker made the hero wait for it
  (1.36 s median). The LCP limit became 1.3 s, the median of 3 runs (owner decision).
- Permanent Marker is Apache-2.0 (NOTICE). Self-hosted WOFF2, no Google Fonts request
  (CSP stays `'self'`). Sample-driven text outside the subset is set in the body face.
- `font-display: optional` plus a metric-matched fallback (`size-adjust`), under our own
  family name, so CLS stays 0.
- Scale: display 96/68/40/24, body 19/17/15, small 13. Headings `text-wrap: balance`.

## 4. Components

- **CaseBoard**: wooden frame, cork surface, 3×3 grid with the subject card in the
  centre and up to 6 clue cards around it, plus a case tag and a sticky note. Red
  yarn is one decorative inline SVG behind the grid (`aria-hidden`), lines from each
  clue's slot centre to the centre slot. At ≤ 760 px the grid becomes one column and
  the yarn is hidden. The board has an accessible name and the cards are a list.
- **ClueCard**: paper card, pin on top, slight rotation (−2.5° to +2.6°, set by
  variant class, removed on phones and under reduced motion), `kind` label in a
  rotated red box (Suspect #n, Evidence, Accomplice, Caught, Alibi), Marker title,
  typewriter body, source line naming the tool. **Every card carries a small
  "SIMULATED" rubber stamp inside its own border** (`<SimulatedStamp>`), so a cropped
  card keeps its label (`check:stamps` covers it).
- **SubjectCard**: the dark centre card ("Your AI", or "Your LLM endpoint" /
  "Your agents' tools" on the product sites).
- **CaseTag**: "Case HAL-001 · Example Co · simulated demo run · fictional system".
- **StickyNote**: yellow, rotated, one short line (for example who the detectives are).
- **Buttons**: primary `--yarn` on white text; ghost outline. 50 px tall, 44 px minimum.
- **Hover**: cards straighten and scale 1.03; nothing else moves. Reduced motion: none.

## 5. Copy (approved wording)

- Hero: "Who's draining your AI?" with the line "Is your AI slow, expensive or
  leaking? Halotrcer puts two detectives on the case, on your own system: Tokvera on
  your LLM endpoint and Sievant on your agents' tools."
- Primary CTA: "Open your case" (to `/book`). Secondary: "Copy this case file".
- Pricing heading: "Hire the detectives". Combined service label: "Both detectives".
- Clue card wording from the mockup, with every number rendered from
  `content/samples/*.json` through the existing sample loader or `<Claim>`, never typed.

## 6. Pages

| Host / page | Board subject | Clues |
|---|---|---|
| www `/` | Your AI | all six from the mockup |
| tokvera `/` | Your LLM endpoint | repeated prompts, rush hour, failed requests, grade (Provisional scoring.) |
| sievant `/` | Your agents' tools | MCP server B (accomplice), credential (caught), MCP server A (alibi), tool calls blocked |
| `/pricing`, `/audit`, review pages | none | "Hire the detectives" paper section and case-tag styling |
| sample reports | none | paper "case file" styling: each section a typed sheet with its stamp |
| docs, blog, legal | none | paper body, Marker headings only; reading comfort first |

## 7. Unchanged rules

Every existing gate stays: Lighthouse 100 ×4, LCP < 1.2 s, CLS 0, page ≤ 250 KB,
JS ≤ 20 KB gz, strict CSP (no inline style or script), claim scan, stamps,
pre-launch mode, WCAG 2.2 AA in both themes, no-JS rendering, permanent URLs.
The one rule this direction changes: self-hosted font files are now allowed (owner
decision 2026-10-23), within the page-weight budget.
