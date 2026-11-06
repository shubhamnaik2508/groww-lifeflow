# UX and product review (2026-11-07)

## Problem-solution alignment

| Element | Assessment |
|---|---|
| Segment | Clear and specific (22–26, Tier 2, first SIP within 12 months). |
| Problem | Credible and specific: life events disrupt cash flow, and users are unsure about SIP commitments. **Not yet evidenced** by research in the repo or the Evidence Log. |
| Solution delivered | The journey First salary → Life event → Simulator → Cash-flow impact → AI Companion → Safe next step is fully implemented. "Discuss with LifeFlow AI Companion" carries the saved scenario into the Companion, which says "Using your saved scenario". |
| Gaps | (1) There is no habit loop (reminders or return triggers) despite the "habit-support" positioning; My Journey records events but doesn't prompt return. (2) Job transition doesn't model a zero-income month numerically, only in words (added in this audit). (3) Comparison is functional but plain text. |

## Journey walkthrough (a first-time user, local production build)

1. **First screen:** the onboarding panel states the purpose, the disclaimer and the non-affiliation (added). The headline and "Explore a Life Event" button are clear. ✔
2. **Financial input:** four labelled fields. The estimate updates live, with warnings for unusual values and an inline error for invalid ones. ✔ Default values are ₹0, so the first-time estimate shows ₹0.00 rather than an empty state; a minor clarity issue.
3. **Life-event selection:** five cards with one-line descriptions; the form changes per event. ✔
4. **Scenario result:** before → after figures, a detail sentence and the formula. ✔ Readable at 320 px after the fix.
5. **Comparison:** works once two scenarios are saved. With fewer than two, the selects are empty and no hint explains why (P3).
6. **Into the AI Companion:** one click; the context line shows the scenario used. The verification panel uses plain language. ✔
7. **My Journey:** events and scenario history; reset with confirmation. ✔
8. **Independence:** a first-time user can complete the journey without help **on a running instance**. Every browser step is covered by `mentor-e2e` (23/23) and `simulator-e2e` (10/10). Not verified with real users.

## Accessibility and responsive results (`scripts/ux-audit.cjs`)

Five pages at 320, 375, 430, 768 and 1440 px (25 combinations), measured before and after this audit's fixes:

| Measure | Before | After |
|---|---:|---:|
| Horizontal overflow (px, sum) | 45 (Scenario Lab at 320 px) | **0** |
| Text below 11 px | 480 | **0** |
| Text below WCAG AA contrast (4.5:1, or 3:1 for large text) | 689 | **0** |
| Tap targets under 44 px | 177 | **50** (all are 24 px source links, which meet WCAG 2.2 AA 2.5.8, plus the 32 px desktop dock toggle) |
| Form controls without a label | 0 | 0 |
| Buttons or links without an accessible name | 0 | 0 |
| Console or page errors | 1 (favicon 404) | **0** |
| Keyboard focus visible (first 12 tab stops) | 10–11 / 12 | 10–11 / 12 (the remaining ones are body or hidden inputs) |

Fixes kept the charcoal and emerald identity: darker emerald for labels (#2b7356), darker muted text (#5c6b63), unchanged layout. Screenshots are in `test-results/ux-audit-final/`.

**Not done:**
- a Dark Warm contrast audit (that theme has its own palette);
- real screen-reader testing (NVDA or TalkBack);
- `prefers-reduced-motion` checks beyond the dock transition;
- physical-device testing.

## Trust and clarity

- **Strong:** the "Illustrative mode" chip, the "not a bank balance" wording, *entered by you* vs *calculated by LifeFlow* labels, honest Reliability metrics, and the disclaimer near every answer.
- **Added:** the "not affiliated with or endorsed by Groww" statement in the onboarding panel and footer. The brand name previously implied an official Groww product.

## AI vs a non-AI alternative (for the final presentation)

| | Deterministic calculator plus fixed FAQ | LifeFlow AI Companion |
|---|---|---|
| Arithmetic | Same (both use the TypeScript engine) | Same: the AI never computes |
| Free-text questions about one's own situation | Keyword routing to a fixed template | Interprets the question and connects it to the user's specific figures and dates |
| Explaining what is unknown | Generic list | Specific to the situation (e.g. "salary arrives 3 days after the SIP date; balance not entered") |
| Grounding | Static FAQ text | Each claim cites a LifeFlow fact or an official SEBI/AMFI excerpt, checked before display |
| Risk | Low | Hallucination and advice risk, mitigated by the fail-closed gate |
| Availability | Always | Falls back to the rule-based guide when unavailable or blocked (at least half the time in recorded fixture runs) |

**Justification:**

- **Benefit.** First-time investors ask situational questions ("salary is late and my SIP is due — what now?"). A calculator answers "how much"; the AI explains "what this means for me and what to check", tied to the user's own numbers, without giving advice.
- **Integrity.** The deterministic engine owns the numbers, and the gate owns the safety.
- **Trade-off, honestly.** The value is currently argued, not measured. The gate blocks many AI answers, so users often see the rule-based guide. A small user comparison (rule-based vs AI explanation for the same scenario, rated for clarity and confidence) is needed to prove AI earns its place.

## Product improvement opportunities (prioritised)

1. **P1:** run 3–5 user sessions comparing the AI and rule-based explanations; record findings and changes.
2. **P2:** add an empty-state hint to comparison ("Save two scenarios to compare").
3. **P2:** model the job-gap month numerically (a zero-income month estimate), not only in words.
4. **P2:** show empty states instead of ₹0.00 for first-time Home metrics.
5. **P3:** a visual before/after bar for scenario results, matching the Home flow bar.
6. **P3:** a habit loop, e.g. a "check again before your SIP date" reminder stored locally.
