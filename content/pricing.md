---
# Single source for prices and scopes. Owner decision 2026-10-21 (PLAN.md, Q2).
# Rendered inside data-owner-source; the claim scan treats it as owner-sourced.
# Kickers (the self-select lines) are owner copy from the Case File design, 2026-10-23.
source: owner
decided: 2026-10-21
currency: USD
services:
  - id: performance-audit
    name: AI Performance & Observability Audit
    kicker: Your bill or latency
    product: tokvera
    from: 3500
    duration: About 2 weeks
    summary: Find where your LLM inference is slow, failing or expensive, and leave the instrumentation behind.
    deliverables:
      - Instrumentation and dashboards, left in place
      - A ranked fix list
      - A signed report
      - A 60-minute walkthrough
  - id: agent-security-review
    name: Agent Security Review
    kicker: Your customer's security review
    product: sievant
    from: 7500
    duration: 1–2 weeks
    summary: See what your agents can reach and put a checkpoint in front of their tools.
    deliverables:
      - A threat model
      - Sievant deployed, in observe mode first, then enforcing
      - A posture report for your customer's security review
      - A walkthrough
  - id: cost-security-audit
    name: AI Cost & Security Audit
    kicker: Both detectives
    product: www
    from: 9500
    # Confirmed by the owner on 2026-10-23 (Case File design).
    duration: 2–3 weeks
    summary: Both audits, with one combined report.
    deliverables:
      - Everything in the AI Performance & Observability Audit
      - Everything in the Agent Security Review
      - One combined report
founding_offer:
  title: Founding clients
  text: The first two clients get 50% off in exchange for a case study.
---
