# Public AI demo: providers, limits and cost

The deployed site is fully public: there is no login, password or passcode. Mentors can use every feature, including live
AI answers from **Google Gemini** (LifeFlow's default, labelled *Recommended*) or **Groq** (labelled *Alternative*).
"Recommended" states LifeFlow's preferred default; it is not a claim that one model is objectively better.

## Providers

| Provider | Model (pinned) | Why | Paid price per 1M tokens |
| --- | --- | --- | --- |
| Google Gemini (default) | `gemini-3.5-flash-lite` (`GEMINI_MODEL` to change) | Stable Flash-Lite model with JSON-schema output and `minimal` thinking; low cost | $0.30 input, $2.50 output (thinking billed as output) |
| Groq (alternative) | `openai/gpt-oss-120b` (`GROQ_MODEL`) | Existing model; strict JSON-schema output | Billed by Groq, outside the Gemini cap |

Both run only on the server (`/api/lifeflow/companion`). Keys are read from server environment variables, are never
sent to the browser, never appear in responses or logs, and are never prefixed `NEXT_PUBLIC_`. Every answer passes the
same deterministic calculations and quality gate. The AI explains LifeFlow's figures but never computes them, and
it never recommends products or predicts returns. A provider failure gives a clearly labelled rule-based guide and an
**"Ask <other provider> instead"** button. LifeFlow never switches provider silently.

## Protection (applies to both providers)

All counters live in the shared Upstash Redis store, never in browser storage or serverless memory. On Vercel, if the
store is missing or unreachable, AI requests are refused (**fail closed**). Visitor addresses are stored only as keyed
HMAC digests.

| Limit | Value |
| --- | --- |
| Per visitor | 6 AI questions a minute, 30 an hour, 60 a day (IST day) |
| Per visitor, at once | 1 question in flight |
| All visitors, at once | 6 questions in flight |
| All visitors, per day | Gemini 400, Groq 500 (backstops) |
| **Gemini spend, all visitors** | **₹100 a day** including 18% GST (about $0.96 at ₹88/$), estimated from Gemini's reported token usage. Each call reserves its worst case ($0.0087) before it runs and settles to the actual cost afterwards. Change it with `GEMINI_DAILY_BUDGET_INR` in Vercel (₹1–₹1,000), then redeploy. |
| Request size | 10 KB body, 600-character question |
| Output | Gemini 2,048 tokens including thinking (`minimal`); Groq 4,096 |
| Origin | Cross-site POSTs are rejected |

Safety-rule refusals and clarifying questions never reach a model, so they do not use any allowance.

### Expected cost

Measured prompts are about 1,800–2,400 input tokens; answers are about 500–1,000 output tokens.

- **Typical Gemini answer:** about $0.003 (≈ ₹0.30 with GST). It's up to twice that when the quality gate asks for one retry.
- **Daily ceiling:** ₹100, about 300 typical Gemini answers a day across all visitors. Spend happens only when people ask questions.
- **Monthly ceiling at full use every day:** about ₹3,000. That is **above the ₹630 Google project cap**, which full use would reach in about 6–7 days.
  - Once Google's cap is reached, Google refuses further Gemini requests. Visitors then see the labelled rule-based guide and the "Ask Groq instead" button.
  - Google's cap is not an absolute guarantee against overages.
  - To keep the monthly maximum under ₹630, set `GEMINI_DAILY_BUDGET_INR` to 20 or less.
- Watch the Google Cloud billing page while the demo is public.

## Kill switches

1. **Instant, no redeploy:** in the Upstash console, run `SET lifeflow:ai:disabled 1`. Live AI stops for everyone within
   one request. To resume, run `DEL lifeflow:ai:disabled`.
2. **Environment:** set `AI_DEMO_ENABLED` to anything other than `true` in Vercel and redeploy. Live AI runs only when
   it is exactly `true`.

While AI is paused, calculations, scenarios, Market Pulse and the labelled rule-based guide keep working.

## Checks

- **`lib/gemini-route.test.ts`:** covers the following.
  - Gemini is the default, with strict JSON and capped tokens.
  - Groq can be chosen.
  - Gemini errors are mapped, and Gemini never switches provider silently.
  - Spend is recorded and the budget is refused when reached.
  - Both kill switches work, and the endpoint fails closed.
  - Per-visitor, concurrency, global-day and global-in-flight limits.
  - Cross-site requests are rejected, and visitor addresses are stored only as digests.
- **`lib/route-security.test.ts`:** the existing Groq behaviour, run against the shared-store guard.
- **`scripts/ai-providers-e2e.cjs`:** the picker in the browser.
  - First visit selects Gemini.
  - Switching keeps context and each provider's answer.
  - A failure offers the other provider.
  - Keyboard use and phone layout work.
  - No keys or key names reach the browser.
  - Set `LIFEFLOW_LIVE_AI=1` to also ask both real providers.
