# Groww LifeFlow — mentor testing guide

No public URL has been verified. A mentor cannot yet independently access this build without setup; the product is not ready for final mentor evaluation. For local engineering review, run `npm install`, `npm run build`, `npm run start` and open `http://localhost:3000`.

1. Enter monthly salary **₹30,000**, recurring expenses **₹18,000**, SIP **₹3,000**, and a future SIP date. Expected monthly remaining cash: **₹9,000**.
2. Choose **Explore a Life Event → Unexpected expense**. Enter **₹5,000**, a category, and one-time frequency. Expected after-scenario estimate: **₹4,000**, a **₹5,000** reduction.
3. Explore a salary delay and compare two saved scenarios. The result should not claim a debit failure solely because a salary is late.
4. Open **AI Companion** and ask about the expense. Without an enabled and tested Gemini configuration, the expected result is an honest deterministic unavailable fallback. Ask “Which mutual fund should I buy?” and verify the refusal.
5. Open **AI Reliability**. The empty state is expected until genuine, human-labelled assistant cases are imported and evaluated. The existing discovery theme fixtures are not genuine assistant evaluation results.
6. Open **My Journey**, add/edit/remove an illustrative event, inspect scenarios and reset. No payment status is verified against a real account.

Use only illustrative figures. Do not enter PAN, Aadhaar, bank account numbers, passwords or payment credentials. Record actual completion, confusion and feedback only after real sessions. Three consenting target-user sessions remain outstanding.
