# Security and deployment audit (2026-11-07)

No Groq requests were made, and no environment variable values were printed.

| Area | Check performed | Result |
|---|---|---|
| Client/server separation | The Groq client lives in `lib/ai/groq.ts` with `import 'server-only'`; a build scan found `api.groq.com` / `GROQ_API_KEY` in **0** files under `.next/static` | PASS |
| Secrets in version control | `git ls-files` shows no `.env*` tracked; `.env.local` is ignored; `.env.example` holds placeholders only | PASS |
| Key-like strings in the repo | Regex scan for Groq, Google, OpenAI and AWS key formats (excluding `node_modules`, `.next`, `.env.local`) | None found |
| Sensitive logging | No `console.*` calls in `app/` or `lib/` (non-test) | PASS |
| Input validation | Strict Zod schemas; 10 kB streamed body limit; encoding check; scenario recomputed server-side; unknown fields rejected (route tests) | PASS |
| Sensitive-data collection | No PAN, Aadhaar, password or account fields; pre-AI rule rejects them if typed | PASS |
| Rate limiting | 20 per minute per client; Upstash (shared) or explicit memory mode; fails closed on Vercel otherwise (tests) | PASS (memory mode is per-instance, best effort) |
| Error handling | Provider and gate errors become labelled fallbacks; the simulator works during an AI outage (tests) | PASS |
| Dependencies | `npm audit`: **0 vulnerabilities**; `groq-sdk` and `@mlc-ai/web-llm` pinned exactly | PASS |
| Security headers | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`; `X-Powered-By` removed (checked with curl) | PASS |
| Content-Security-Policy | Not set | GAP (P2) |
| Build quality | Production build passes; type-check clean; **no lint configured** | PARTIAL |
| Browser console errors | 0 across 25 page-and-width combinations (after the favicon fix) | PASS |
| Claims about accounts and transactions | Disclaimer: does not access accounts or execute transactions; no such code exists | PASS |
| Affiliation | Now states "Independent educational prototype, not affiliated with or endorsed by Groww" in the UI and metadata | PASS (fixed) |
| Privacy messaging | Companion explains that the question and figures go to LifeFlow's server and Groq; local storage is opt-in; reset available | PASS |
| **Version control** | GitHub `main` = `8e9b865`; **all Groq, gate, Reliability and audit work is uncommitted** | **FAIL (P0)** |
| **Vercel deployment** | No `.vercel` link, no deployment URL | **FAIL (P0)** |
| HTTPS, HSTS, real proxy behaviour | Requires a deployment | NOT VERIFIED |

## Outstanding risks

1. **Uncommitted work (P0).** A disk problem or accidental reset would lose all recent work, and deployment from GitHub would ship the old version.
2. **No deployment (P0).** Mentors cannot access the product.
3. **Groq free-tier rate limits.** Bursts give labelled fallbacks; `LIFEFLOW_RATE_LIMIT_MODE=memory` is per-instance on Vercel.
4. **Data sent to Groq.** Questions and illustrative figures go to a third party. Groq's data-use terms have not been reviewed in this project.
5. **No CSP and no lint or CI.** Lower assurance against regressions and injection.

## Deployment steps (requires your approval)

Follow `DEPLOYMENT.md`:

1. Commit and push.
2. Import into Vercel.
3. Set `GROQ_API_KEY`, `GROQ_MODEL=openai/gpt-oss-120b` and the rate-limit variables.
4. Deploy.
5. Run `npm run test:e2e` against the URL, and use `MENTOR_DEMO_CHECKLIST.md`.
