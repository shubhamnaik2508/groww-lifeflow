# NextLeap Part 5 compliance report — Groww LifeFlow (2026-11-07)

Statuses are based only on evidence produced in this repository and session. "Local" means the production build running on the development laptop; nothing has been deployed.

| # | Requirement | Status | Evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| 1 | Functional MVP | **PASS (local)** | All five areas work in the production build: 254 unit tests; browser suites `mentor-e2e` 23/23, `groq-companion-e2e` 7/7, `browser-ai-states-e2e` 7/7, rule-based, themes and dock. | Not deployed (#11). |
| 2 | Clearly defined user problem | **PASS** | README and `GROQ_AGENT_ARCHITECTURE.md`: first-time salaried investors (22–26, Tier 2) facing cash-flow uncertainty around SIP commitments after life events. | Not validated with users (#12). |
| 3 | Life-to-SIP Scenario Simulator | **PASS** | Five scenarios, deterministic TypeScript (₹30,000 − ₹18,000 − ₹3,000 = ₹9,000; −₹5,000 gives ₹4,000), comparison and history. Unit and browser tests. | — |
| 4 | Genuine Groq-powered AI | **PARTIAL** | Real Groq calls verified: authentication, strict structured output, gated answers in 0.9–2.6 s, 4 of 8 fixture answers passing the gate in the final run, and correct figures for changed inputs (`GROQ_API_TEST_RESULTS.md`). | The model in your `.env.local` (`llama-3.3-70b-versatile`) is **not available** to your Groq account, so the app on port 3000 currently returns labelled fallbacks. Verified working with `openai/gpt-oss-120b`. Update `GROQ_MODEL` to that. |
| 5 | Actual evaluation gate | **PASS** | Schema, arithmetic, claim-to-source, safety and uncertainty checks run on every AI answer, fail closed, and are tested independently, including against real Groq and browser-model outputs (`AI_GATE_TEST_RESULTS.md`). | Rule-based: cannot catch every wrong meaning (documented known limitation). |
| 6 | Visible quality checks | **PASS** | Verification panel and per-check list built only from checks that ran; claims show "Based on"; model, prompt and latency shown (browser test). | — |
| 7 | Safe fallback | **PASS** | Labelled rule-based guide with the specific reason for: missing key, unavailable model (observed live), rate limit (observed live), timeout, network, outage, malformed or unsafe output. The simulator keeps working. | — |
| 8 | Golden-set evaluation using the Evidence Log | **PARTIAL** | Runner and Reliability panel run the real pipeline and store every required field. The Evidence Log import works. Four real Groq runs on engineering fixtures are recorded (`GOLDEN_SET_EVALUATION.md`). | The Evidence Log contains **only synthetic records with theme labels**, so **0 genuine human-labelled cases** exist and no accuracy can be measured. A human-labelled companion set is needed. |
| 9 | Explanation of why AI is needed | **PASS** | `GROQ_AGENT_ARCHITECTURE.md` → "Why AI is needed here"; the Companion page explains that LifeFlow calculates and the AI explains. | — |
| 10 | Explicit prohibition of investment advice | **PASS** | Mandatory disclaimer on onboarding, Home and every answer; advice requests stopped before the AI (4 brief questions plus others tested live); output directives blocked. | — |
| 11 | Production deployment | **NOT VERIFIED** | Vercel-ready: Next.js build passes, `.env.example`, server-only secrets, route `maxDuration`, rate-limit modes, security headers (`DEPLOYMENT.md`). | Not deployed; needs your approval, Vercel environment variables and public-URL verification. |
| 12 | Independent mentor task completion | **NOT VERIFIED** | `MENTOR_TESTING_GUIDE.md` prepared; no login; no download needed in Groq mode. | No mentor or user session has taken place. |

## Before marking items 4, 8, 11 and 12 as PASS

1. Set `GROQ_MODEL=openai/gpt-oss-120b` in `.env.local` and in Vercel, then rerun `npm run test:groq`.
2. Deploy to Vercel with `GROQ_API_KEY` and `GROQ_MODEL`, plus either Upstash variables or `LIFEFLOW_RATE_LIMIT_MODE=memory`. Then run `npm run test:e2e` and `npm run test:groq` against the public URL.
3. Create and run a human-labelled companion golden set (`GOLDEN_SET_EVALUATION.md`).
4. Run at least three mentor or user sessions with `MENTOR_TESTING_GUIDE.md` and record the results.
