# AI evidence compliance review (2026-11-07)

**Scope:** a review of existing documents, code and recorded results only. As instructed, **no Groq requests or model inference were run** in this audit.

## Evidence inventory

| Artefact | What it contains | Assessment |
|---|---|---|
| `GROQ_AGENT_ARCHITECTURE.md` | Pipeline, provider, endpoint, prompt v3.2, gate rules, limitations | Complete and consistent with the code |
| `GROQ_API_TEST_RESULTS.md` | Real connectivity (authentication, model, strict JSON); a changed-input answer; mocked provider errors | Real results are recorded with dates; mocks are labelled as mocks |
| `AI_GATE_TEST_RESULTS.md` | Each gate tested independently; real-output regressions; known limitation | Strong; states what rules cannot catch |
| `GOLDEN_SET_EVALUATION.md` | Evidence Log findings; runner; seven fixture runs with the real model; reviewed passes and blocks; salary-delay fix | Honest; **no genuine human labels** |
| `evaluation/runs/*.json` | Raw per-case results: model, prompt version, timestamp, checks, failure category | Present (engineering-fixture runs only) |
| `lib/ai/__fixtures__/*.json` | Real Groq and on-device model outputs used as regression tests | Provenance stated in each file |
| Code: `lib/ai/gate.ts`, `pipeline.ts`, `context.ts`, `app/api/lifeflow/companion/route.ts` | Implementation | Matches the documents (spot-checked) |

## Requirement-by-requirement review

| Requirement | Evidence | Status |
|---|---|---|
| A real quality gate | `gateModelOutput` runs schema → arithmetic → claim support → safety → uncertainty before any display; `runCompanion` returns AI text only when `gate.passed` | **PASS** |
| Validation before display | The API returns `kind:'model'` only after the gate passes; otherwise `rule-based` with `fallback_reason` (route tests) | **PASS** |
| Arithmetic consistency safeguards | Placeholders and literal figures checked against TypeScript facts; role, direction and timing checks; tests include ₹6,000 vs ₹4,000 | **PASS** |
| Source-grounding safeguards | Per-claim support ids; fabricated or irrelevant ids rejected; lexical support check (documented as a heuristic, not entailment) | **PASS (with documented limits)** |
| Investment-safety safeguards | Pre-AI advice and injection rules; output directive, returns and institution rules; the brief's four advice questions tested | **PASS** |
| Uncertainty handling | Certainty and speculation rejected; clarifying question when context is missing | **PASS** |
| Safe fallback | Labelled rule-based guide with a reason for every provider and gate failure; the simulator keeps working (outage test) | **PASS** |
| Visible quality-check results | Verification panel and check list built only from executed checks (UI test with a mocked answer; live screenshots recorded in earlier work) | **PASS** |
| Failure categories | `failure_category` per case in the runner output and the Reliability panel; reviewer override available | **PASS** |
| Golden-set measurement | Runner records the human expected answer, actual output, model, prompt, timestamp, checks and reviewer fields; **0 genuine human-labelled cases** | **FAIL** |
| Evidence Log as golden source | 20 synthetic records with theme labels; CSV export empty; import mechanism labels them a simulation | **FAIL** (data), **PASS** (mechanism) |

## Reliability panel consistency

The panel shows "Genuine labelled cases: 0" and "Accuracy: Not claimed", and it explains that the Evidence Log is synthetic. That matches the evidence. Fixture and simulation imports carry warning labels and are excluded from the genuine count (browser-tested). **Consistent.**

## Observations relevant to the AI value claim (from existing reports)

- In recorded fixture runs, **1–4 of 8 (7 recorded runs)** AI answers passed the gate. The rest fell back to the labelled rule-based guide. A mentor should expect to see the fallback regularly.
- The gate needed many iterations to stop blocking correct paraphrases. False-positive risk remains, and it is documented.
- One known limitation stays open: a correctly cited but semantically wrong claim can pass. It is kept as a test.

## Missing or unverifiable evidence

1. A human-labelled golden set: 20–50 companion questions with expert-written expected answers and provenance, plus a recorded run and reviewer scores.
2. Evidence that users find AI explanations more useful than the rule-based guide (#10 in the matrix).
3. A recorded AI run on the **deployed** URL.

**No critical AI defect was found in the existing evidence, so the AI implementation was not changed in this audit.**
