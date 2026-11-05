# Groww LifeFlow

Life changes. Your money plan adapts. Independent educational prototype; not affiliated with Groww.

## Current status

This is a local work-in-progress, not a production-ready or publicly deployed product. Five destinations, illustrative monthly cash flow, five scenario forms, scenario comparison, a local event timeline, and an honest AI-unavailable fallback are implemented. Browser interaction, mobile layout, accessibility, and all end-to-end scenario paths have not yet been verified. The manifest exists but installability and offline support are not verified.

**AI is not implemented or enabled.** The companion endpoint does not call Gemini and cannot produce AI responses. Its deterministic fallback performs input validation and a limited keyword check; this is not a complete safety gate. Do not deploy as a production AI product until the requested structured provider integration, source grounding, numerical validation, adversarial safety tests and genuine golden-set evaluation are implemented and pass. The environment entries in `.env.example` are placeholders for that future work and currently have no effect.

The reliability panel honestly shows no imported examples or results. The separate SIP Discovery Engine labels research excerpts for themes; these are not automatically valid expected answers for this assistant. A proper labelled assistant question set requires human review. No user study has been performed.

## Run locally

Requires Node.js compatible with Next.js 16. Run `npm install`, `npm run dev`, then open http://localhost:3000. Run `npm test` for deterministic calculation tests and `npm run build` for a production build. No secrets are needed for the current fallback.

## Data and privacy

There is no database or account integration. Profile, scenarios and events live in React memory unless the user opts into localStorage on their device; the reset control removes them. The companion API receives the question and illustrative context, and its current fallback does not call external services or log financial inputs. The in-memory request limit is per server instance and is not suitable as a production distributed rate limit. Input fields are not yet equipped with reliable sensitive-data detection; users should not enter credentials or account identifiers.

## Source

The source library records one SEBI educational booklet, verified on 2026-11-06. It supports the basic SIP definition only, not bank-specific payment rules. The current fallback does not claim its response is source-grounded. Source maintenance and additional official material are needed.

## Deployment and evaluation prerequisites

Implement and test the AI provider abstraction and fail-closed quality gate; create a genuine labelled evaluation set and regression runner; verify sensitive-data handling, rate limiting, all scenarios, accessibility, PWA installation, and mobile/desktop interaction; connect a GitHub repository and Vercel project; deploy and verify the public URL. Record real user feedback using `MENTOR_TESTING.md`. No production URL, commit or user-study results are claimed.
