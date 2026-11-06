# Groq API test results — 2026-11-07

Environment: Windows 11, Node 24.18, production build (`next build` and `next start`), groq-sdk 1.6.0. The API key was read from `.env.local` and never printed. Command: `npm run test:groq -- --url <server>` (`scripts/groq-connectivity.mjs`).

## Test B — Groq connectivity

### With the model configured in `.env.local` (`GROQ_MODEL=llama-3.3-70b-versatile`), server on port 3000

| Test | Expected | Actual | Status |
| --- | --- | --- | --- |
| Authentication | Key accepted | `/models` returned 11 models | PASS |
| Model availability | Configured model listed | `llama-3.3-70b-versatile` **not listed** for this account; chat request returned 404 | FAIL |
| Structured output | Valid JSON | Not reached (404) | FAIL |
| App behaviour when the model is unavailable | Honest labelled fallback, no crash | `Rule-based guide · not AI`, `fallback_reason: provider_model_unavailable`, notice "The configured AI model is not available…" | PASS |

**Remaining issue:** with the current `.env.local`, the app never produces an AI answer. Changing `GROQ_MODEL` to `openai/gpt-oss-120b` (listed for this account) fixes it. I did not edit `.env.local` because it holds your key.

### With `GROQ_MODEL=openai/gpt-oss-120b` set for a separate test server on port 3001 (process environment only)

| Test | Expected | Actual | Status |
| --- | --- | --- | --- |
| Authentication | Key accepted | 11 models visible | PASS |
| Model availability | `openai/gpt-oss-120b` listed | Listed | PASS |
| Strict structured output | `json_schema` strict response parses | Parsed in 424 ms | PASS |
| Server reports AI available | `ai_available: true` | `true`, model `openai/gpt-oss-120b`, prompt `lifeflow-agent-v3.2` | PASS |
| End-to-end reference question (₹30,000 / ₹18,000 / ₹3,000, ₹5,000 one-time) | A gated answer | Passed the gate in 4 of 5 evaluation runs (blocked in the first run, prompt v3, for an unsupported "as recommended by SEBI" claim). In the first connectivity run it was blocked by claim support, then passed on a direct rerun; output varies between runs. | PASS (variable) |
| Response time | Interactive | 0.9–2.6 s per answer (one 10 s outlier during a rate-limit retry) | PASS |

Model list visible to the account: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `openai/gpt-oss-safeguard-20b`, `qwen/qwen3.8-27b`, `allam-2-7b`, two prompt-guard models, two Whisper models and two Orpheus TTS models.

## Test C — Contextual AI (changed inputs)

| Test | Expected | Actual | Status |
| --- | --- | --- | --- |
| Reference scenario | ₹9,000 → ₹4,000 | Gated answer: "Before the expense, LifeFlow estimates ₹9,000.00 left… After the one-time expense of ₹5,000.00, the estimate becomes ₹4,000.00." | PASS |
| Changed scenario: ₹52,000 / ₹30,000 / ₹6,000, ₹8,000 repair | ₹16,000 → ₹8,000, no old figures | Gated answer: "Before the expense, LifeFlow estimates ₹16,000.00 left… After the one-time expense of ₹8,000.00, the estimate becomes ₹8,000.00. The change in estimated remaining cash is -₹8,000.00." No ₹9,000 appeared. | PASS |
| Prompt context follows the inputs | Facts in the prompt change with the profile | Unit test `changes the explanation context when the user changes their figures` (₹45,000 salary gives `{remaining_now} = ₹24,000.00` and `{scenario_after} = ₹19,000.00`) | PASS |

## Provider error handling (unit tests with the real SDK error classes, `lib/route-security.test.ts`)

Mocks prove the handling; they do not prove Groq behaves this way in every case.

| Case | Expected | Actual | Status |
| --- | --- | --- | --- |
| Missing API key | No Groq call; labelled fallback; reason `missing_key` | As expected | PASS |
| Invalid key (401) | `provider_auth`, safe message | As expected | PASS |
| Invalid or unavailable model (404) | `provider_model_unavailable` | As expected. Also observed live with `llama-3.3-70b-versatile`. | PASS |
| Rate limit (429) | `provider_rate_limited`, "busy" message | As expected. Also observed live twice during back-to-back evaluation calls. | PASS |
| Timeout | `provider_timeout` | As expected | PASS |
| Network failure | `provider_network` | As expected | PASS |
| Outage (5xx) | `provider_unavailable` | As expected | PASS |
| Strict-schema rejection (400) | `provider_schema_rejected` | As expected | PASS |
| Truncated or empty completion | `provider_truncated` / `provider_empty` | As expected | PASS |
| Malformed JSON | One retry, then `gate_schema` fallback, `attempts: 2` | As expected | PASS |
| Key never appears in any response | — | Asserted in status and error tests | PASS |
| Model without strict support | `json_object` mode with the schema in the prompt; still gated | As expected (unit) | PASS |

## Test G — API outage (browser)

`scripts/groq-companion-e2e.cjs` (mocked 503): the Companion shows "temporarily unavailable … not an AI response", and the Scenario Lab still calculates ₹9,000 → ₹7,000 for a rent increase. **PASS**

## Not verified

- The deployed Vercel endpoint (not deployed).
- Behaviour under sustained concurrent load.
- Groq's data-use terms (review them before production).
