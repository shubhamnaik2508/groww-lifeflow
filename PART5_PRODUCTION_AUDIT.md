# Groww LifeFlow — Part 5 production audit

## Initial audit before fixes

Baseline: commit `c509f8c`; repository was clean. Next.js 16 / React 19 / TypeScript with Zod and Vitest; no application database. Browser-local data is optional. The server API reads a Gemini key and Upstash rate-limit settings from its environment; no environment files are present. Vercel deployment and real service credentials are not verified.

The baseline `npm test` executed 29 tests in three files, all passing. The existing Codex Security scan found request-body buffering before its size check, conditional forwarded-header spoofing, and incomplete browser-state reset. These findings require reproducible regression tests. The project contains no `Groww FirstPay` references in the searched first-party files.

The assistant is a Gemini intent classifier followed by server-owned response templates, not free-form model-generated financial explanation. It does not pass salary/expense figures or source excerpts to the model. The deterministic response design prevents model-generated numbers or arbitrary citations reaching users, but the requested full model-output grounding and arithmetic gate is not implemented. Live Gemini and genuine golden-set evaluations were not verified; the reliability panel accepts human-labelled imports, but no legitimate assistant answer dataset has been supplied. The separate SIP Discovery Engine theme labels are not assistant answer labels.

Initial verdict: **NOT READY — CRITICAL FIXES REQUIRED**. This baseline is retained before source changes; final results and acceptance statuses follow after testing.

## Final audit — 2026-11-06

**Verdict: NOT READY — CRITICAL FIXES REQUIRED.** The local product is usable for the tested flows, but the requested public deployment, real model evaluation and genuine labelled assistant dataset remain unverified or missing. The live Gemini path is disabled by default; the model selects a constrained intent, while code selects explanatory text and calculations. This is not the requested full contextual model-generation and factual-grounding pipeline.

| # | Acceptance criterion | Status | Evidence / limitation |
|---|---|---|---|
| 1 | Local entry without login, value and disclaimer | PASS | Production-mode Edge check passed. |
| 2 | Salary, expenses, SIP and snapshot | PASS | Edge entered ₹30,000/₹18,000/₹3,000 and displayed ₹9,000. |
| 3 | Five scenario happy paths | PASS | Edge exercised all five; 61 automated tests include scenario checks. |
| 4 | All scenario invalid inputs and boundaries | PARTIAL | Empty/invalid cases are covered in unit tests, but not every field/boundary in a browser. |
| 5 | Compare two scenarios | PASS | Edge selected two independent scenarios and saw the difference. |
| 6 | Journey events, history and reset | PASS | Edge added, edited and removed an event, viewed saved scenarios and checked reset. |
| 7 | Navigation, direct destinations and back | PASS | Five destinations and fragment-based direct navigation/back were exercised locally. |
| 8 | Mobile/tablet/desktop layout | PASS | Basic navigation, heading visibility and horizontal overflow checked at all seven requested sizes; full accessibility and visual polish not exhaustively tested. |
| 9 | Deterministic reference calculation | PASS | Unit and Edge tests produced ₹9,000 baseline, ₹4,000 after expense and ₹5,000 reduction. |
| 10 | Live AI execution | NOT VERIFIED | No Gemini key was available; transport was tested with doubles only. |
| 11 | Full contextual AI explanation | FAIL | Gemini receives question and limited scenario metadata, not amounts, calculations or source text; responses are controlled templates. |
| 12 | Eval-gated output and visible checks | PARTIAL | Strict enum schema and server-owned outputs prevent model prose/numbers/citations; no general factual-entailment or arithmetic-comparison gate exists. |
| 13 | Investment safety and injection resistance | PARTIAL | Targeted synthetic test cases pass; no complete adversarial evaluation or guarantee of all unsafe requests. |
| 14 | Official source grounding | PARTIAL | SEBI and AMFI pages were accessible and support the SIP definition; no verified bank/AMC-specific rules or general claim-level grounding. |
| 15 | Genuine golden-set evaluation | FAIL | Discovery database has 20 labels, all fixture-marked, and zero non-simulated runs; they are theme labels, not assistant answers. No genuine assistant evaluation was run. |
| 16 | Security and privacy | PARTIAL | Prior scan issues were addressed locally; deployed proxy behavior, broad secret detection and external services remain unverified. |
| 17 | PWA installation | NOT VERIFIED | Manifest and icons exist; installation/offline behavior was not exercised. |
| 18 | Public production deployment | NOT VERIFIED | No verified public URL; Vercel team access returned 403. No deployment attempted in this audit. |
| 19 | Independent mentor completes entire journey | FAIL | Local deterministic steps work; live AI explanation and genuine evaluation results are unavailable. No independent mentor session occurred. |
| 20 | Three real-user tests and documented feedback | FAIL | No real sessions or feedback were supplied or fabricated. |
| 21 | Production build | PASS | `npm run build` completed with Next.js 16.4.5. |
| 22 | End-to-end secret and runtime configuration | PARTIAL | Server-side settings and fallback exist; no live credentials, public runtime configuration, or comprehensive secret scan verified. |

**Readiness score: 9/22 applicable criteria = 40.9%.** Nineteen were assessed at least partially and three are not verified. This is an acceptance-criteria score, not model accuracy. The numerator counts only PASS, not PARTIAL. The final test and fix details are in `PART5_TEST_RESULTS.md`, `AI_EVAL_AUDIT.md`, and `PART5_FIX_LOG.md`.

AI adds natural-language intent selection when enabled; the existing non-AI engine performs arithmetic, dates, comparisons and all displayed educational wording. The current bounded classifier is useful for routing but does not yet supply the richer contextual explanation requested by the assignment.
