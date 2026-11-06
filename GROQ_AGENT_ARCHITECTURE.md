# LifeFlow AI Companion — Groq agent architecture

Status as of 2026-11-07. Measured results are in `GROQ_API_TEST_RESULTS.md`, `AI_GATE_TEST_RESULTS.md` and `GOLDEN_SET_EVALUATION.md`.

## Journey

FIRST SALARY → LIFE EVENT → CASH-FLOW IMPACT → GROQ AI EXPLANATION → EVALUATION GATE → SAFE NEXT STEP

The user enters illustrative monthly figures (Home), runs a life event in the Life-to-SIP Scenario Simulator (Scenario Lab), and asks the AI Companion about it. LifeFlow calculates every figure in TypeScript, Groq's hosted model explains them, and the answer is shown only if it passes every gate. Otherwise the user sees a clearly labelled rule-based guide and the reason.

## Why AI is needed here

The calculations are deterministic and need no AI. The model adds three things a fixed template cannot:

1. It interprets a free-text question about the user's own situation (salary delay, rent, job gap, failed debit, mandates).
2. It connects that question to the specific calculated facts and official excerpts in plain language.
3. It says what is unknown for that particular situation.

Every one of those claims is checked against the deterministic facts and approved sources before display. The model never owns a number, a rule or a citation.

## Request flow

```
Browser (app/page.tsx)                         Server (app/api/lifeflow/companion/route.ts)
  question + illustrative profile + scenario  →  size limit (10 kB, streamed) · encoding check · rate limit
                                                   · Zod validation (strict, bounded fields)
                                                   · scenario RECOMPUTED server-side (client results never trusted)
                                                 lib/ai/pipeline.ts runCompanion()
                                                   0. pre-AI rules (lib/ai/context.ts preflight)
                                                      sensitive data · prompt injection (question AND scenario text)
                                                      investment advice · bank/AMC rules, fees, returns, tax · unclear/missing context
                                                   1. deterministic fact sheet (user vs calculated, with formulas) + assumptions A1… + missing info
                                                   2. approved source retrieval by topic (lib/sources.ts)
                                                   3. Groq generation (lib/ai/groq.ts) — structured JSON, 25 s timeout
                                                   4. gate (lib/ai/gate.ts): schema → arithmetic → claim-to-source → safety → uncertainty
                                                   5. PASS → structured answer · FAIL → labelled rule-based guide + reason
  ← CompanionAnswer JSON (no secrets, no logs of inputs)
```

## Provider (lib/ai/groq.ts)

| Item | Value |
| --- | --- |
| SDK | `groq-sdk` 1.6.0 (official, Apache-2.0), pinned exactly |
| Default model | `openai/gpt-oss-120b`. It is a Groq **production** model, it supports **strict** JSON-schema structured outputs, and it is available to the configured account (verified via `/models` on 2026-11-07). |
| Configuration | `GROQ_API_KEY` and `GROQ_MODEL`, server-side only (`.env.local` locally; Vercel environment variables in production). `LIFEFLOW_AI_ENABLED=false` is a kill switch. |
| Structured output | Strict `json_schema` for models Groq lists as strict-capable (`gpt-oss-20b/120b`, `qwen/qwen3.8-27b`, `meta-models/muse-spark-open`). Other models use `json_object` mode with the schema in the system prompt. Server-side Zod validation applies either way. |
| Reasoning | `reasoning_effort: "low"` and `include_reasoning: false` for gpt-oss models, so reasoning text is never returned. |
| Timeouts and retries | 25 s per request; SDK `maxRetries: 1` for transient errors; **one** extra attempt only when the output fails schema validation. Safety, arithmetic and grounding failures are never retried. |
| Errors | `toProviderError` maps every SDK error to a stable code and a user-safe message: missing key, invalid key (401), forbidden (403), invalid or unavailable model (404), rate limit (429), timeout, network, schema rejection (400), outage (5xx), truncated, empty. Provider bodies are never shown. |
| Secrets | `import 'server-only'`; the key is never returned by any endpoint and never logged. The build output was checked: `api.groq.com` appears only in `.next/server`, not in `.next/static`. |

## Endpoint: `/api/lifeflow/companion`

- `GET` returns `{provider, ai_available, model, prompt_version, unavailable_reason, rate_limit}`. It never returns the key.
- `POST` takes `{question (≤600 chars), profile, scenario?}`, with strict schemas and amounts 0–₹10 crore. Over 10 kB returns 413, a compressed body returns 415, invalid input returns 400, and the rate limit returns 429. If the limiter is unavailable on Vercel the route returns 503 (fails closed).
- `maxDuration = 30` seconds.
- Rate limiting: 20 requests per minute per client.
  - On Vercel the client is identified by the platform-supplied address. It uses the shared Upstash limiter when configured; otherwise it fails closed unless the operator explicitly sets `LIFEFLOW_RATE_LIMIT_MODE=memory` (per-instance, best effort).
  - Locally a single process bucket is used.
- No question text or financial figures are logged.

## Context given to the model (`lib/ai/context.ts`, `lib/ai/prompt.ts`)

- **Facts:** each has an id, label, display value, origin (*entered by the user* or *calculated by LifeFlow*) and, for calculated values, a formula. Examples: `remaining_now = salary − recurring_expenses − sip_amount`; `scenario_after = scenario_before − one_time_expense`; `timing_statement` is a sentence LifeFlow writes ("The delayed salary is expected 3 days after the SIP debit date.").
- **Assumptions** (A1, A2, …), for example "The one-time expense affects only the illustrated month."
- **Missing information**, determined in code (for example "available balance not entered", "new salary unknown").
- **Sources:** verbatim excerpts with their limitations, selected by topic.
- **The question:** inside `<<< >>>` delimiters, marked untrusted.

Prompt `lifeflow-agent-v3.2` asks for claim-level output:

```json
{"summary":"…","points":[{"text":"… {scenario_after} …","supports":["scenario_after"]}],
 "missing_information":[],"next_steps":[],"uncertainty":"…","requires_abstention":false,"abstention_reason":""}
```

The schema's `supports` items are an enum of the ids actually supplied, so in strict mode the model cannot cite an id that does not exist.

## Response returned to the UI (`CompanionAnswer`)

`scenario`, `summary`, `explanation`, `claims[]` (each with resolved supports), `known_facts`, `user_facts`, `calculated_facts`, `assumptions`, `missing_information`, `sources`, `next_steps`, `uncertainty`, `requires_abstention`, `abstention_reason`, `safety_flags`, `checks[]` (every stage with passed / failed / not run / not applicable), `label`, `notice`, `fallback_reason`, `model {id, provider, prompt_version, params}`, `raw_output`, `latency_ms` and `attempts`.

## Evaluation gate (`lib/ai/gate.ts`)

| Brief gate | Implementation |
| --- | --- |
| 1 Schema | Strict Zod: 1–6 claims, length limits, unknown keys rejected, at least one next step unless abstaining, abstention needs a reason. |
| 2 Arithmetic | Every placeholder must be a known fact, and every literal figure or date must equal an entered or calculated value. Amounts in words, `k` shorthand, percentages and rupee-formatted dates are rejected. Also rejected: direction contradictions, "remaining cash available for the SIP", salary-timing contradictions, and figures for an unknown new salary. |
| 3 Source grounding | Every claim must list support. Unknown or fabricated ids are rejected. A figure must be cited in the same claim and equal a value of a cited fact. A claim citing a source must overlap lexically with that excerpt (at most 34 % unsupported content words). A concept claim without a source is rejected. Fact-citing claims without figures must stay close to the cited facts, and assumption-only claims close to the assumption. Also rejected: links, unapproved authorities, uncited SEBI/AMFI mentions, concept answers drifting into personal figures, and "no penalty" without the bank-charges caveat. |
| 4 Financial safety | Directive verbs plus investment objects (stems, five-word window, including "you can save/invest"); returns, guarantees, growth and percentages; payment-rule terms not present in a cited excerpt (hedged bank caveats and missing-info items may mention fees or charges); named banks, brokers or fund houses; account-access claims; instruction echoes. Restating what a fund house *may* do (from AMFI) is allowed. |
| 5 Uncertainty | No certainty about payment outcomes, no guessed causes ("can be due to…"), and the uncertainty statement must acknowledge a limit. Missing context is handled before the AI: the request is stopped with a clarifying question. |
| 6 Provider failures | Labelled rule-based fallback with the specific reason; calculations and sources still shown. |
| 7 Prompt injection | Pre-AI rule on the question and scenario fields; delimited untrusted text in the prompt; the output gate rejects instruction echoes. Retrieved sources are static, verified excerpts. |

Checks run in order and stop at the first failure. Later checks are shown as *not run*, never as passed.

## UI (`app/AnswerView.tsx`, `app/page.tsx`)

- Companion mode: **LifeFlow AI · Groq (recommended)** (default), **Rule-based guide · not AI**, **Experimental · on-device model (large download)**.
- A status line shows whether the server has AI configured, and which model and prompt version.
- Each answer shows:
  - a **Verification** panel in plain language, built only from checks that ran (calculation consistency, source support, safety screening, uncertainty, missing information, official verification required);
  - claims with "Based on: …" support;
  - official sources with excerpt and limitation;
  - what the user entered vs what LifeFlow calculated, assumptions, missing information, next steps and uncertainty;
  - the model, prompt and latency;
  - the disclaimer.
- The onboarding banner on Home shows the full disclaimer until acknowledged.

## Experimental browser model

The WebLLM path (Qwen2.5-1.5B, about 880 MB) stays available as an opt-in option and is labelled experimental. It uses the same prompt, schema and gate. It is never downloaded unless the user chooses it.

## Legacy

`lib/companion.ts` (the earlier Claude/OpenAI/Gemini intent classifier) is no longer used by the app and is marked LEGACY; its unit tests still run. The old `/api/companion` route was replaced by `/api/lifeflow/companion`.

## Limitations

- The gate is rule-based. It blocks the error patterns seen in real outputs but cannot prove an answer true. A correctly cited claim that is wrong in meaning passes; a test (`KNOWN LIMITATION`) documents this.
- Claim-to-source support is a lexical-overlap heuristic, not entailment. It is conservative: correct paraphrases are sometimes blocked (see the evaluation results).
- Groq output varies between runs even with a fixed seed, so pass rates vary.
- The free tier has token-per-minute limits; rapid repeated questions can hit a 429 and get the labelled fallback.
- Sources cover SIP basics, mandates and fund-house treatment of missed instalments only. Bank-specific charges, retries and NACH rules are not covered, so LifeFlow abstains or adds a caveat.
- Data sent to Groq: the question, illustrative figures and scenario inputs. No names, PAN, Aadhaar or account details are collected. Review Groq's own data-use terms before production use; this document makes no claim about them.
