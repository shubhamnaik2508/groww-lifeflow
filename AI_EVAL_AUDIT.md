# Groww LifeFlow — AI evaluation audit

## Provider and architecture

Live Gemini: **NOT VERIFIED**. No credential was available. The server-side transport and 401, 429, 500, timeout and malformed-output handling were exercised with synthetic doubles. Gemini receives the user's question and scenario type/date-presence metadata, not financial amounts, deterministic results or approved source excerpts. Its structured output is an intent enum. Zod rejects extra, missing and invalid fields; application code supplies all displayed figures, source links and educational sentences. This is an intentionally constrained classifier, not a complete model-generated contextual explanation.

## Quality checks and safety

The tested boundary rejects model doubles that add a ₹6,000 calculation or a fabricated source; the actual ₹30,000 − ₹18,000 − ₹3,000 − ₹5,000 scenario remains ₹4,000. This is **schema rejection and server-owned arithmetic**, not a comparison of model-generated numeric claims. The application does not implement general claim-level source entailment, model-authored citations, or an arithmetic checker for arbitrary model prose. Those assignment requirements remain unmet. The UI reports executed checks rather than an accuracy percentage.

Synthetic tests cover five specified investment requests, three override/invent-source prompts, invalid schema, missing/invalid credentials via simulated HTTP errors, rate limit, provider failure and timeout. All final automated tests pass. The filter is pattern-based and cannot establish that every paraphrase or sensitive detail is caught. The model has no ability to publish its own prose or numbers, but it can select an irrelevant permitted template. Live-provider and comprehensive adversarial safety behavior remain unverified.

## Source verification

On 2026-11-06 the [SEBI financial education booklet](https://investor.sebi.gov.in/pdf/downloadable-documents/Financial%20Education%20Booklet%20-%20English.pdf) and [AMFI SIP page](https://www.amfiindia.com/investor/become-mf-distributor?zoneName=sip) were accessible and support the basic SIP definition. Neither establishes a particular bank or fund-house payment rule. The UI includes links; a browser check verified the SEBI href, not the destination's rendering in the local browser. No AMC or bank-specific source is present or claimed verified. The source library is curated static data, not live retrieval.

## Golden-set provenance and results

The separate `groww_sip_lab.db` was opened read-only. It contains **20 evidence theme labels**, all 20 marked as fixtures under the repository's fixture criteria, and **0 non-simulated evaluation runs**. The schema labels evidence themes and rationales rather than expected answers for this assistant. Therefore the number of legitimate assistant golden-set examples is **0**, the number of genuine assistant model evaluations is **0**, and accuracy, passes, failures, correct/incorrect abstention and failure-category rates are **not calculable**. The app's import/review facility does not convert fixtures into real labels. No synthetic fixture was reported as user research.

Create a legitimately human-reviewed question/expected-answer/rationale set from suitable evidence, establish consent and provenance, run a real configured model, record versions/timestamps and review every dimension. A small sample does not demonstrate production-wide accuracy.
