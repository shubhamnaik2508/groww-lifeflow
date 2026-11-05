# Groww LifeFlow

Life changes. Your money plan adapts. Independent educational prototype; not affiliated with Groww.

## Status

This is a release candidate for local evaluation, not a verified production deployment. The five destinations, illustrative monthly cash-flow visualisation, five scenario forms, shared calculation engine, scenario comparison, a local event timeline, source library, Gemini integration, conservative answer gate and human evaluation workspace are implemented. The live Gemini path is disabled by default and has not been tested with real credentials. Interactive browser, mobile, accessibility, installability, security and public-deployment verification remain outstanding. No real user-study outcomes or golden-set scores are claimed.

## Run locally

Requires a Node.js version supported by Next.js 16. Run `npm install`, `npm run dev`, then open http://localhost:3000. Run `npm test` and `npm run build` to validate. No key is needed for the deterministic fallback. To conduct a controlled live-provider test, copy `.env.example` to `.env.local`, set `GEMINI_API_KEY`, optionally set `GEMINI_MODEL`, and set `LIFEFLOW_AI_ENABLED=true` only after reviewing the release checklist below. Restart the server. Never put the key in client code or commit it.

## AI architecture and safety limits

The server validates the request, recomputes profile and scenario figures using shared TypeScript functions, and makes a Gemini structured-output request for one of seven intent labels. The provider receives the question and limited scenario type/date-presence context, not salary or expense amounts. The server validates the exact schema and builds the displayed response using controlled educational text and deterministic values. The model cannot directly supply prose, numbers, citations or transactions. Unsupported account-specific questions and recognised recommendation requests receive an abstention. Provider errors and malformed output receive a deterministic fallback. Source links are attached only to the controlled SIP definition.

These protections do not establish perfect semantic classification, sensitive-data detection, or comprehensive investment-advice detection. A model can choose an irrelevant allowed template. The keyword filters are defense in depth, not proof of safety. Adversarial and human evaluation, real provider testing, and a broader source library are required before enabling the live path publicly. Do not record sensitive details in questions or scenario fields. The user-supplied question is sent to Gemini when the path is enabled.

## Scenario and data assumptions

The cash formula is take-home salary minus recurring expenses, SIP and applicable one-time expense. A recurring new expense is illustrated as an extra monthly cost. Rent assumes previous rent is included once in recurring expenses, and validates it does not exceed those expenses. A salary delay does not predict failure. An unknown new salary is shown as unknown. Results are estimates, not bank balances or verified transactions.

There is no database or account integration. Profile, scenarios and events stay in browser memory unless the user opts into localStorage. The reset control removes them. Evaluation cases and human reviews can be exported as JSON and re-imported; they are not automatically persisted. Local development uses a process-local request limit. On Vercel the companion API requires an Upstash Redis REST URL and token plus a separate rate-limit HMAC salt of at least 32 characters; it fails closed when the store is unavailable or misconfigured. It uses the Vercel forwarded address and stores only a keyed digest for a short window. Verify trusted proxy behavior for your deployment and test the shared limiter against a real store before release.

## Evaluation

The reliability panel imports an array of up to 15 human-labelled objects with `id`, `question`, `expected`, and `rationale`; it runs the real companion endpoint with a clearly disclosed illustrative profile. Reviewers label each dimension and outcome and enter corrections, then export a traceable JSON file with output, versions and timestamp. Re-import restores a prior export. No synthetic fixtures are represented as human labels, and no automated accuracy score is asserted. A small sample cannot establish production-wide accuracy. Existing research theme labels in the separate SIP Discovery Engine are not automatically valid expected answers for this companion. A proper answer set requires human review.

## Sources

The SEBI financial education booklet and AMFI SIP education page were checked on 2026-11-06 for their basic SIP definitions. They do not substantiate specific bank or fund-house payment rules. Source maintenance and additional official material are needed.

## Release checklist

- Obtain a server-side Gemini key and test live responses, errors and abuse paths with the feature flag enabled in a controlled environment.
- Gather genuine human-labelled assistant cases, review actual outputs, and run a documented regression and safety suite before enabling AI publicly.
- Configure and verify the shared Upstash rate limiter on Vercel, validate sensitive-data handling and review privacy/security controls.
- Verify every interactive path, responsive layout, keyboard accessibility and PWA installation in real browsers; complete the tests in `MENTOR_TESTING.md` with at least three consenting target users.
- Connect a GitHub repository and Vercel project, set server-only environment variables, deploy, and verify the actual public URL. No deployment or user-study result is currently claimed.
