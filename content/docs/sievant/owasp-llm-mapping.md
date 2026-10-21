---
title: "OWASP Top 10 for LLM Applications: Sievant control mapping"
source:
  repo: sievant
  path: docs/owasp-llm-mapping.md
  ref: main
  commit: 8529db16ad9ab178c7131966ba1c6fa5588047fc
prelaunch: true
order: 10
---

> This maps Sievant's controls to the OWASP Top 10 for LLM Applications categories they address. It is not a compliance certification, an audit or an assessment of any system, and it does not mean a category's risk is fully mitigated: each control addresses part of a category, within what an MCP gateway can see.

Edition **2025**, mapping version 1. Source: <https://genai.owasp.org/llm-top-10/> (categories, titles and links retrieved 2026-10-18). The mapping is data, embedded in the binary: `internal/defaults/packs/owasp-llm-2025.yaml`; `sievant policy owasp [--json]` prints it, and `sievant policy packs` shows the categories each policy pack addresses. This page mirrors that file, and a test fails when they disagree: change the file first.

## By category

| Category | Sievant controls |
|---|---|
| [LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) | `injection-detection`, `tool-pinning`, `withheld-primitives` |
| [LLM02:2025 Sensitive Information Disclosure](https://genai.owasp.org/llmrisk/llm022025-sensitive-information-disclosure/) | `argument-rules`, `input-sanitization`, `output-redaction`, `withheld-primitives`, `scan` |
| [LLM03:2025 Supply Chain](https://genai.owasp.org/llmrisk/llm032025-supply-chain/) | `tool-pinning`, `scan` |
| [LLM04:2025 Data and Model Poisoning](https://genai.owasp.org/llmrisk/llm042025-data-and-model-poisoning/) | Not addressed: Training and fine-tuning data are outside an MCP gateway's view. |
| [LLM05:2025 Improper Output Handling](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/) | `argument-constraints` |
| [LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) | `policies`, `argument-constraints`, `argument-rules`, `ssrf-guard`, `scan` |
| [LLM07:2025 System Prompt Leakage](https://genai.owasp.org/llmrisk/llm072025-system-prompt-leakage/) | Not addressed: System prompts stay between the client and the model; Sievant does not see them. |
| [LLM08:2025 Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/) | Not addressed: Sievant does not manage vector stores or embeddings (a retrieval tool behind it is subject to its other controls). |
| [LLM09:2025 Misinformation](https://genai.owasp.org/llmrisk/llm092025-misinformation/) | Not addressed: Whether model output is true is outside what a gateway can check. |
| [LLM10:2025 Unbounded Consumption](https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/) | `rate-limits`, `output-budgets` |

## Controls

| Control | Configuration | Packs | Categories | How |
|---|---|---|---|---|
| Deny-by-default policies for tools, prompts and resources, per agent (`policies`) | `policies` | (always on or configured directly) | LLM06 | An agent can call only the tools its policy allows, so a steered model cannot reach the rest. |
| Schema validation and argument constraints (min, max, in, matches, path_under, url_hosts) (`argument-constraints`) | `policies[].constraints` | (always on or configured directly) | LLM05, LLM06 | Tool arguments are model output sent to a backend; they are validated against the tool's schema and the policy before the backend sees them. |
| Path and URL argument rules for every tool (`argument-rules`) | `arguments` | `fs-paths`, `egress` | LLM02, LLM06 | Path arguments must stay under listed roots and URL arguments must go to listed hosts, narrowing what a steered agent can read or send out. |
| Credentials and personal data in tool arguments blocked or redacted (`input-sanitization`) | `sanitization.input_credentials, sanitization.input_pii` | `secrets-pii` | LLM02 | Secrets and personal data the model puts into arguments do not reach the backend (or reach it redacted). |
| Credentials and personal data redacted from tool results (`output-redaction`) | `sanitization.detectors` | `secrets-pii` | LLM02 | Results are redacted before the model sees them, so they cannot be repeated to the user or sent elsewhere. |
| Prompt-injection detection on arguments and results (flag, annotate, block) (`injection-detection`) | `injection` | `injection` | LLM01 | Instruction-like text in tool results (indirect injection) and arguments is scored, recorded, and annotated or blocked. |
| Tool definitions read once, pinned, and pinned on first use (`tool-pinning`) | `connectors.mcp[].tools[].sha256, pinning` | `description-pinning` | LLM01, LLM03 | A server cannot change a tool's description (instructions the model reads) or schema after it was reviewed without the tool being withheld. |
| Upstream resources and prompts not served unchecked (`withheld-primitives`) | `connectors.mcp[].serve_resources, serve_prompts` | (always on or configured directly) | LLM01, LLM02 | Upstream resources and prompts are withheld, and the withholding reported, unless the connector sets serve_resources or serve_prompts; served ones pass the output checks tool results pass (budgets, redaction, injection detection), and prompt arguments pass input sanitization. |
| Rate limits per agent and per tool (`rate-limits`) | `rate_limit` | `rate-limits` | LLM10 | A runaway or steered agent cannot call tools without bound. |
| Row, byte and response-memory budgets (`output-budgets`) | `output, server.limits` | (always on or configured directly) | LLM10 | Results are bounded in size and over time, limiting cost and context flooding. |
| SSRF guard on outbound connectors (`ssrf-guard`) | `connectors.*.allow_private_networks` | (always on or configured directly) | LLM06 | Connectors cannot be pointed at private networks unless allowed. |
| Client configuration audit (sievant scan) (`scan`) | `(command)` | (always on or configured directly) | LLM02, LLM03, LLM06 | Finds hard-coded secrets, unpinned or remotely fetched servers, and over-broad access before they are used. |
| Audit trail of every call and security event (`audit-trail`) | `audit` | (always on or configured directly) | (none) | Supports investigating every category above; it does not prevent any by itself. |

## Packs

`packs: [owasp-llm]` turns on the packs that need no input from you (`secrets-pii`, `injection`, `rate-limits`, `description-pinning`). `fs-paths` and `egress` also address LLM02 and LLM06; add them with your roots and hosts (`arguments.paths.under`, `arguments.urls.hosts`).
