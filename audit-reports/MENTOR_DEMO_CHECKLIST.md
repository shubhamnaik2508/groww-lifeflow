# Mentor demo checklist

**URL:** _not yet deployed_. After deployment, replace this line with the verified public URL. Until then, the demo is local: `npm run build && npm run start`, then open http://localhost:3000. That needs `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-120b` in `.env.local`.

No login and no download. Use illustrative figures only.

## 10-minute journey

| # | Where | Do this | Expect |
|---|---|---|---|
| 1 | Home | Read **Before you start** → **I understand** | Disclaimer; "not affiliated with or endorsed by Groww" |
| 2 | Home | Salary **30000**, expenses **18000**, SIP **3000**, SIP date **5 Dec 2026** | Estimated remaining **₹9,000.00**; flow bar fills |
| 3 | Scenario Lab | **Unexpected expense**: 5000, Health, One-time → **See the impact** | Before ₹9,000.00 → After **₹4,000.00**; "affects the illustrated month only" |
| 4 | Scenario Lab | **Salary delayed**: expected 1 Dec 2026, delay 7, SIP date 5 Dec 2026 | "Expected salary: 2026-12-08, 3 day(s) after the SIP date… Timing alone does not establish a failed debit" |
| 5 | Scenario Lab | **Rent increase**: 8000 → 10000, Dec 2026 | After **₹7,000.00** |
| 6 | Scenario Lab | **Job transition**: previous 30000, gap 30, new salary blank | After **Unknown**; "your recurring expenses and SIP (₹21,000.00 a month) continue" |
| 7 | Scenario Lab | **SIP debit failure**: status "failed" | "The reason and applicable rules are unknown" |
| 8 | Scenario Lab | **Compare two scenarios**: pick expense and rent | Each shown against its own baseline; difference shown |
| 9 | AI Companion | From a saved scenario, press **Discuss with LifeFlow AI Companion**, then ask "How does this expense affect my cash?" | Either **AI-generated · passed every quality check**, with a Verification panel and "Based on…" per claim, or **Rule-based guide · not AI** with the reason. **Both are expected**: the gate is deliberately strict. |
| 10 | AI Companion | Ask "Which mutual fund should I buy?" | **LifeFlow safety rule · no AI used** |
| 11 | AI Reliability | Read the metrics | Genuine labelled cases **0**; accuracy **Not claimed** |
| 12 | My Journey | Add an event, then **Reset illustrative data** | Timeline updates; reset clears everything |
| 13 | Phone or a narrow window | Repeat steps 2–3 using the bottom navigation | No sideways scrolling; readable text |

## Known limitations to mention

- The AI answer is often replaced by the rule-based guide (at least half the time in recorded fixture runs), by design.
- There is no human-labelled golden set yet, so no accuracy figure.
- Approved sources cover SIP basics, mandates and missed instalments, not bank-specific charges.
- Groq's free tier can return "busy"; wait a moment and retry.
- This is an educational prototype, not affiliated with Groww; no real accounts are involved.
