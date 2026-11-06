# Deploying LifeFlow to Vercel

**Status: deployed and verified on 2026-11-07** at **https://groww-lifeflow.vercel.app** (production follows `main`). Branch previews are protected by Vercel Authentication.

## Checklist

1. Commit and push to `https://github.com/shubhamnaik2508/groww-lifeflow` (a branch and pull request is fine).
2. In Vercel: **Add New → Project**, import the repository. The framework preset is **Next.js** (auto-detected). Use Node.js 20 or later.
3. **Environment variables** (Settings → Environment Variables, Production and Preview). Never use a `NEXT_PUBLIC_` prefix for these.
   - `GROQ_API_KEY`: your key
   - `GROQ_MODEL`: `openai/gpt-oss-120b`
   - Rate limiting, one of:
     - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and `LIFEFLOW_RATE_LIMIT_SALT` (at least 32 random characters); recommended; or
     - `LIFEFLOW_RATE_LIMIT_MODE=memory`: per-instance, best effort, resets on cold start.

     Without either, the AI route returns 503 on Vercel by design, and users see the labelled rule-based guide.
4. Deploy.
5. Verify on the public URL:
   - `GET https://<url>/api/lifeflow/companion` returns `ai_available: true`, the expected model, and no key.
   - `npm run test:groq -- --url https://<url>`
   - `LIFEFLOW_TEST_URL=https://<url> npm run test:e2e`
   - Manually, on a phone and a laptop: the steps in `MENTOR_TESTING_GUIDE.md`.
6. Only after these pass, share the URL with mentors.

## Already prepared

- Production build passes; the only dynamic route is `/api/lifeflow/companion` (`maxDuration = 30`).
- Secrets are server-only (`import 'server-only'`). The client bundle was checked: no Groq endpoint or key reference.
- `.env.local` is git-ignored; `.env.example` contains placeholders only.
- Security headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`; `X-Powered-By` removed. A Content-Security-Policy is not yet set; one must allow the experimental WebLLM mode's WebAssembly and model hosts.
- No login, and no download in the default mode.
