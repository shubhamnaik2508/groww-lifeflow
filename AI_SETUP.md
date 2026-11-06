# LifeFlow AI setup

## Primary: Groq (server-side)

1. Create a key at console.groq.com. Never paste it in chat, commit it or put it in client code.
2. Copy `.env.example` to `.env.local` and set:
   ```
   GROQ_API_KEY=…your key…
   GROQ_MODEL=openai/gpt-oss-120b
   ```
3. `npm run build && npm run start`, then `npm run test:groq -- --url http://localhost:3000`.

`GET /api/lifeflow/companion` reports `ai_available`, the model and the prompt version. It never returns the key.

### Model choice

| Model | Why |
| --- | --- |
| `openai/gpt-oss-120b` (default) | Groq production model; strict JSON-schema structured outputs; available to the configured account (checked 2026-11-07); 0.9–2.3 s per answer in local runs. |
| `openai/gpt-oss-20b` | Smaller and faster alternative with the same strict support. Not evaluated here. |
| Other models | Use JSON object mode with the schema in the prompt and the same server-side validation. Check the model is listed for your account first: `llama-3.3-70b-versatile` was **not** available to this account. |

Pin the model in `GROQ_MODEL` and do not change it during an evaluation; every result records the model id and prompt version.

### Settings

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Required for AI answers (server only) |
| `GROQ_MODEL` | Pinned model id |
| `LIFEFLOW_AI_ENABLED=false` | Kill switch |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `LIFEFLOW_RATE_LIMIT_SALT` | Shared rate limiter on Vercel (recommended) |
| `LIFEFLOW_RATE_LIMIT_MODE=memory` | Explicit opt-in to a per-instance limiter on Vercel when Upstash is not configured. Without either, the AI route fails closed on Vercel. |

Groq's free tier has token-per-minute limits. Rapid repeated questions can return a rate-limit fallback; the Reliability runner spaces requests 8 s apart.

## Rule-based guide (not AI)

Fixed rules and templates (`lib/offline-companion.ts`). This is the labelled fallback whenever an AI answer is unavailable or blocked, and it can also be chosen directly.

## Experimental: on-device model

Optional, labelled experimental, and never the default. It downloads Qwen2.5-1.5B-Instruct (Apache-2.0, about 880 MB, or the 0.5B "Lite" at about 290 MB) and runs it in the browser through WebLLM 0.2.87 (needs WebGPU). It uses the same prompt, schema and gate as Groq. Nothing downloads unless the user selects this mode and presses **Load browser AI**. Earlier measurements and its limits are in `AI_EVAL_AUDIT.md`.

## Pipeline and limits

See `GROQ_AGENT_ARCHITECTURE.md` (pipeline, gate rules, limitations) and `AI_GATE_TEST_RESULTS.md` (evidence).
