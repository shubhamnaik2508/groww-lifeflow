# Groww LifeFlow — test results

Executed 2026-11-06 in the local Windows environment. These are engineering checks, not user research or live deployment evidence.

| Check | Expected | Actual | Result |
|---|---|---|---|
| Baseline `npm test` | Existing tests pass | 29/29 passed | PASS |
| Oversized stream before fix | Reject before buffering with 413 | Returned 400 after reading body | FAIL, reproduced before fix |
| Safety questions before guard fix | Refuse guarantee and sell-investments questions | Two of five synthetic questions were not marked abstention under a controlled model double | FAIL, reproduced before fix |
| Final `npm test` | Calculation, request security and model-double tests pass | 61/61 passed in 4 files | PASS |
| `npm run build` | Next.js production build succeeds | Build passed; `/`, `/api/companion`, and manifest generated | PASS |
| `node scripts/mentor-e2e.cjs` against local production server | Mentor flow, navigation, reset and sizes | 22/22 checks passed in headless Microsoft Edge | PASS |
| Git-history known credential patterns | No matching known key patterns | Zero matches for tested Google/GitHub key and private-key patterns | PASS for patterns only; not a comprehensive secret audit |
| Production client bundle credential patterns | No matching known key patterns | 11 static files checked; zero matches for the same limited patterns | PASS for patterns only |
| `npm audit --audit-level=moderate` | No reported npm advisories | Zero vulnerabilities reported after a network-enabled retry; sandboxed attempt could not resolve the registry | PASS for npm's advisory result at test time |
| Live Gemini / real Redis | Actual configured services respond safely | Credentials not available | NOT VERIFIED |
| Vercel production | Public URL and API work | Team access returned 403; no public URL verified | NOT VERIFIED |

The 22 Edge checks covered local home and disclaimer; ₹30,000 / ₹18,000 / ₹3,000 profile; ₹5,000 unexpected expense yielding ₹9,000 before and ₹4,000 after; salary delay; scenario comparison; rent, unknown job salary and reported SIP failure; fund-recommendation refusal; event add/edit/remove; reset; empty reliability state; fragment direct link and back; opt-in persistence; a delayed response during reset; source-link href; seven viewport sizes (360×800, 390×844, 430×932, 768×1024, 1366×768, 1440×900, 1920×1080); and uncaught page errors. At each size the test checked navigation, heading visibility and horizontal overflow, not exhaustive visual accessibility or touch-target dimensions.

Earlier development-server checks initially failed because the test used `127.0.0.1` while the Next development server blocked its cross-origin HMR resources, and the development overlay intercepted mobile clicks. The final successful run used a production-mode server and `localhost`. CUA automation could not initialize because its Windows sandbox reported `permission path cannot be represented losslessly`; the separate Playwright Core/Edge run supplied the results above. No failure screenshots were captured.

## Mentor sequence

Steps 1–8 (local open, profile, scenario, reference figures and companion navigation) passed in Edge. Step 9 produced a deterministic unavailable fallback, not a live contextual model answer; steps 10–12 for genuine model explanation and its actual source/quality evaluation are **NOT VERIFIED**. Step 13–14 (fund request and refusal) passed locally. Step 15 opened Reliability; step 16 failed the assignment expectation because no genuine labelled assistant results exist. Step 17 (scenario history) passed locally. No independent mentor participated.

Reproduce: `npm install`, `npm run build`, `npm run start`, then in another terminal `npm run test:e2e`. The script uses the installed Windows Microsoft Edge path and defaults to `http://localhost:3000`; `LIFEFLOW_TEST_URL` can override it. Tests use illustrative data. Do not run destructive tests against a live service.
