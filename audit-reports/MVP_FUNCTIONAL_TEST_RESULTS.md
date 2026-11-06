# MVP functional test results — non-AI (2026-11-07)

**Environment:** Windows 11, Node 24.18, Next.js 16.4.5 production build (`next build` and `next start`), Microsoft Edge 156 via Playwright.

**The AI was switched off for every run** (`LIFEFLOW_AI_ENABLED=false`, empty `GROQ_API_KEY`, server on port 3002). No Groq request was made; `GET /api/lifeflow/companion` reported `ai_available: false`.

## Summary

| Suite | Command | Result |
|---|---|---|
| Type-check | `npm run typecheck` | Clean |
| Unit tests (all; Groq mocked, no network) | `npm test` | **279 passed / 0 failed** (10 files) |
| Production build | `npm run build` | Passes |
| Lint | — | **Not configured** (no ESLint setup); gap noted |
| Mentor journey | `scripts/mentor-e2e.cjs` | **23/23** |
| Simulator (new, at 320 px) | `scripts/simulator-e2e.cjs` | **10/10** |
| Rule-based guide | `scripts/offline-companion-e2e.cjs` | PASS |
| Themes, dock, mobile navigation | `scripts/theme-dock-e2e.cjs` | PASS |
| Experimental model UI states (no download) | `scripts/browser-ai-states-e2e.cjs` | **7/7** |
| UX and accessibility measurement (new) | `scripts/ux-audit.cjs` | See `UX_AND_PRODUCT_REVIEW.md` |

## Mandatory calculation

| Input | Expected | Actual | Status |
|---|---|---|---|
| Salary ₹30,000, expenses ₹18,000, SIP ₹3,000 | Baseline ₹9,000 | ₹9,000.00 (unit test, Home metric, browser at 320 px and 1440 px) | PASS |
| Plus a ₹5,000 one-time expense | ₹4,000 after; reduction ₹5,000 | ₹4,000.00; change −₹5,000 (unit test and browser) | PASS |

## Life-to-SIP Scenario Simulator (`lib/simulator.test.ts`, `scripts/simulator-e2e.cjs`)

| Event | Checks | Status |
|---|---|---|
| Unexpected expense | One-time vs recurring labelled distinctly; negative result allowed; missing, **zero** (fixed), negative, non-numeric and over-₹10-crore amounts rejected; decimals exact | PASS |
| Salary delay | Changes timing only (change 0); says it "does not establish a failed debit"; after, before and on the SIP date; month and year boundaries; falls back to the profile SIP date; fractional, negative or excessive delays and invalid dates rejected; optional balance validated | PASS |
| Rent increase | ₹8,000 → ₹10,000 gives ₹9,000 → ₹7,000; rent decrease; decimal rents exact (**rounding fixed**); previous rent over expenses rejected; month validated | PASS |
| Job transition | Unknown new salary stays "Unknown"; **the commitments continuing during the gap (₹21,000 a month) are now stated** (fixed); known new salary illustrated; invalid gaps rejected | PASS |
| SIP debit failure | Status recorded; no reason or rule invented; monthly estimate unchanged; long text truncated | PASS |
| Profile | Zero values allowed; NaN, negative and infinite values rejected; unusual-input warnings | PASS |
| Comparison | Each scenario uses its own baseline; difference correct; unknown-salary scenarios excluded; no overflow at 320 px | PASS |

## Other areas (from `mentor-e2e.cjs` and the simulator suite)

| Area | Result |
|---|---|
| Home dashboard: entry, metrics, flow bar, onboarding disclaimer | PASS |
| My Journey: add, edit and remove events; scenario history listed; reset clears all data and storage | PASS |
| Optional persistence across reload, then reset | PASS |
| Navigation: sidebar, mobile bottom navigation, direct `#hash` links, browser back | PASS |
| Layouts: 320, 360, 375, 390, 430, 768, 1366, 1440 and 1920 px without horizontal overflow | PASS (after the 320 px fix) |
| Themes: LifeFlow, Dark Warm, Blue Oceanic persisted | PASS |
| Page errors and console errors | 0 (after the favicon fix) |

## Defects found and fixed in this audit

See `NEXTLEAP_FIX_LOG.md`. In short:

- 320 px overflow;
- ₹0 expense accepted;
- unrounded rent change;
- job-gap commitments not stated;
- 689 contrast failures;
- 480 sub-11 px text instances;
- small tap targets;
- missing non-affiliation statement;
- favicon 404;
- mobile navigation icons read aloud by screen readers.

## Not verified

- PWA installation.
- Real screen-reader use.
- Contrast in the Dark Warm theme.
- Behaviour on physical phones (emulated viewports only).
- The deployed site.
