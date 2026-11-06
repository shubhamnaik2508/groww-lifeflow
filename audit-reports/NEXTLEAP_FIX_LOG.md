# NextLeap audit fix log (2026-11-07)

All fixes are non-AI. The Groq integration and the evaluation gate were not modified in this audit.

| # | Priority | Defect | Root cause | Fix | Files | Verification |
|---|---|---|---|---|---|---|
| 1 | P1 | Scenario Lab overflowed horizontally by 45 px at 320 px after a scenario was saved | Grid children default to `min-width:auto`, so the wide before→after row forced the column wider than the screen | `min-width:0` on grid children; before→after row wraps; selects capped at 100 % | `app/style.css` | UX audit: overflow 45 → 0 px; `simulator-e2e` comparison at 320 px passes |
| 2 | P1 | 689 text instances below WCAG AA contrast (eyebrows 2.8–3.4:1, muted text 2.3–4.2:1, footer 2.1:1) | Light grey and green tints on pale backgrounds | Darker emerald and grey tokens (#2b7356, #5c6b63, #4f6559, #1f7a58; blue theme #10687a), scoped to the light themes; dark metric card kept light | `app/style.css` | UX audit: 689 → 0 |
| 3 | P1 | No in-app statement that the product is not affiliated with Groww | Only the README said so | Added to the onboarding panel, footer and page metadata | `app/page.tsx`, `app/layout.tsx` | Visible in the UI; mentor suite passes |
| 4 | P2 | 480 text instances below 11 px (8–10 px labels, footer, mobile navigation) | Very small type scale | 11 px minimum (12 px for the disclaimer and footer); mobile nav labels wrap | `app/style.css` | UX audit: 480 → 0 |
| 5 | P2 | 177 tap targets under 44 px (text buttons 14 px tall, theme select 31 px, mobile nav 28 px wide) | Compact styles | 44 px minimum for text buttons, inputs and selects; mobile nav items flex to fill; source links 24 px minimum | `app/style.css` | UX audit: 177 → 50 (only 24 px links, which meet WCAG 2.2 AA, and the desktop dock toggle) |
| 6 | P2 | A ₹0 unexpected expense was accepted | Validation allowed zero | Reject amounts ≤ 0 with "Enter an expense amount above ₹0." | `lib/calc.ts` | Unit and browser tests |
| 7 | P2 | Job transition didn't state the commitments that continue during an income gap | Only the new salary was illustrated | Detail now says "During the gap, your recurring expenses and SIP (₹21,000.00 a month) continue…" | `lib/calc.ts` | Unit and browser tests |
| 8 | P3 | Rent change and scenario change could show floating-point noise with decimal rents | Unrounded subtraction | Rounded to paise | `lib/calc.ts` | Unit test (₹8,000.1 → ₹8,000.4 gives ₹8,999.70) |
| 9 | P3 | Console 404 for `/favicon.ico` | No icon declared | `icons` metadata points to the existing app icon | `app/layout.tsx` | 0 console errors in the UX audit |
| 10 | P2 | Mobile navigation glyphs were read aloud by screen readers; no `aria-current` | Missing ARIA | `aria-hidden` on glyphs, a `nav` label and `aria-current` | `app/page.tsx` | Mentor suite passes |
| 11 | P2 | Checkbox and radio focus not visible | The base input style removed the outline | Visible focus outline for checkbox and radio inputs | `app/style.css` | Keyboard pass in the UX audit |
| 12 | Test gap | No simulator-specific regression suite; no 320 px coverage | — | Added `lib/simulator.test.ts` (25 tests), `scripts/simulator-e2e.cjs` (10 checks), `scripts/ux-audit.cjs`; added to `npm run test:e2e` | new files, `package.json` | 279 unit tests; simulator browser 10/10 |

## Not fixed (requires owner action or out of scope)

These need you to act, or are outside what this audit could change:

- deployment;
- commit and push;
- user testing;
- the golden set;
- research evidence;
- presentation artefacts;
- a CSP;
- lint and CI;
- the Dark Warm contrast audit.

See `FINAL_SUBMISSION_READINESS.md`.
