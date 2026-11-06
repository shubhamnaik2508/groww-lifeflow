# Groww LifeFlow

Life changes. Your money plan adapts. An independent educational prototype for first-time salaried investors in India. Not affiliated with Groww.

**Journey:** first salary → life event → cash-flow impact → Groq AI explanation → evaluation gate → safe next step.

## Status (2026-11-07)

- Five areas: Home, Scenario Lab (Life-to-SIP Scenario Simulator), AI Companion, My Journey and AI Reliability. Three themes, a collapsible desktop dock and mobile bottom navigation.
- **The AI Companion uses Groq** (server-side, `groq-sdk`, default model `openai/gpt-oss-120b`) behind a fail-closed evaluation gate. Real Groq calls have been verified locally (`GROQ_API_TEST_RESULTS.md`) and on the public site. Users need no download or login.
- **Live:** https://groww-lifeflow.vercel.app (verified 2026-11-07; see `DEPLOYMENT.md`).
- **Golden set:** no genuine human-labelled companion cases exist. No accuracy is claimed (`GOLDEN_SET_EVALUATION.md`).
- Compliance summary: `PART5_COMPLIANCE_REPORT.md`.
- **Market Pulse** (`/#market-pulse`): Daily Market Brief for NIFTY 50 and SENSEX, a neutral SIP Decision Explorer, history, news and a gated AI insight. Index data stays off until a licensed source is configured; see `MARKET_PULSE.md`.

## Run locally

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env.local   # then put your own GROQ_API_KEY in .env.local
npm run build
npm run start
```

Open http://localhost:3000. Without a key, the AI Companion shows the labelled rule-based guide and everything else works.

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests: calculations, context, gate, pipeline, Groq adapter and route, WebLLM adapter |
| `npm run typecheck` | TypeScript |
| `npm run test:e2e` | Browser suites in Edge against `LIFEFLOW_TEST_URL` (default `http://localhost:3000`) |
| `npm run test:groq -- --url http://localhost:3000` | Real Groq connectivity and end-to-end test (reads `.env.local`, never prints the key) |
| `npm run eval:golden -- <dataset.json> --url …` | Runs an evaluation file through the app's pipeline; saves results in `evaluation/runs/` |
| `npm run export:evidence-log -- "<groww_sip_lab.db>" evaluation/evidence-log-export.json` | Read-only export of the SIP Discovery Engine Evidence Log for import |
| `npm run test:market-pulse` | Market Pulse browser test (synthetic data inside the test only) |
| `npm run test:market-pulse:live` | Opt-in: Market Pulse analyst against real Groq with synthetic evidence |
| `npm run test:real-model` | Optional: experimental on-device model test (large download, needs WebGPU) |

## How it works

See `GROQ_AGENT_ARCHITECTURE.md`. In short:

1. **LifeFlow calculates every figure** in TypeScript and labels each one *entered by you* or *calculated by LifeFlow*.
2. **Pre-AI rules** stop sensitive data, prompt injection, advice requests and bank-rule questions, and ask for missing context.
3. **Groq explains** using those facts, their formulas, assumptions and verbatim SEBI/AMFI excerpts. Its output is strict JSON in which every claim lists its support.
4. **The gate** checks schema, arithmetic, claim-to-source support, investment safety and uncertainty. Only a fully passing answer is shown as AI. Otherwise the labelled rule-based guide is shown, with the reason.
5. **The UI** shows a plain-language verification panel and the full check list, built only from checks that actually ran.

The AI never accesses an investment or bank account and cannot execute transactions.

## Data and privacy

There is no database and no account integration. The profile, scenarios and events stay in the browser unless the user opts into storage on the device. **Reset illustrative data** removes them. In Groq mode, the question, illustrative figures and scenario inputs go to LifeFlow's server and then to Groq. No names, PAN, Aadhaar or account details are collected. Never enter them.

## Other documents

- `AI_SETUP.md`: configuration, model choice, experimental on-device model.
- `AI_GATE_TEST_RESULTS.md`, `GROQ_API_TEST_RESULTS.md`, `GOLDEN_SET_EVALUATION.md`: test evidence.
- `MENTOR_TESTING_GUIDE.md`, `MENTOR_TESTING.md`: mentor and user testing.
- `AI_EVAL_AUDIT.md`: earlier on-device model runs (2026-11-06).
- `fixtures/README.md`: evaluation file format.
