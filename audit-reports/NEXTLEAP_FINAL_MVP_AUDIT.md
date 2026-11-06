# Groww LifeFlow — final NextLeap MVP audit (2026-11-07)

> **This is an independent assessment, not an official NextLeap grade.** The official Part 5 brief and rubric were not found on this machine (see "Assignment sources"), so the scoring uses the independent rubric supplied with the audit request.

> **Deployment update (2026-11-07):** PR #1 was merged (`main` = `8761625`) and the public production site **https://groww-lifeflow.vercel.app** was verified the same day:
> - status endpoint: `ai_available: true`, model `openai/gpt-oss-120b`, prompt v3.2, rate limiter in memory mode;
> - a live reference answer passed every quality check (₹9,000 → ₹4,000) in 1.5 s, and an advice question was stopped by the safety rule;
> - browser suites against the public URL: mentor journey 23/23, simulator 10/10, Groq companion 7/7, model states 7/7, rule-based guide and themes pass;
> - accessibility audit: 0 overflow, 0 small text, 0 low contrast, 0 console errors across 25 page-widths;
> - Blue Oceanic is the default theme; no login is required.
>
> Updated independent score: **68 / 100**. Requirements passed: **8 / 18**. **P0 blockers: 3** (user testing, golden set, research evidence).

## Executive summary

LifeFlow is a well-engineered, locally working MVP. The Life-to-SIP Scenario Simulator is accurate and well tested. The Groq AI Companion sits behind a real, documented, fail-closed evaluation gate, and safety handling is strong.

It is **not ready to submit**:

- It is not deployed.
- None of the recent work is committed or pushed.
- There is no genuine user research, user testing or human-labelled golden set to support the product and AI claims.

This audit fixed every verified non-AI defect it found: 320 px layout overflow, WCAG contrast and text-size failures, simulator edge cases, and a missing non-affiliation statement. It added 25 simulator unit tests, a 10-check simulator browser suite and a reusable UX audit script.

| | Score |
|---|---|
| **Current score (before this audit's fixes)** | **58 / 100** |
| **Post-fix verified score** | **64 / 100** |
| **Submission readiness** | **NOT READY** |

## Category scores

| Category | Max | Before | After | Main evidence | Priority |
|---|---:|---:|---:|---|---|
| Problem-solution fit | 15 | 10 | 10 | The segment, problem and journey are clearly defined, and the product implements them end to end. However, **no user research or evidence** supporting the problem exists in the repository or on this machine; the Evidence Log is synthetic or empty. | P0 (evidence) |
| MVP functionality and completeness | 20 | 16 | 18 | All five areas work locally. Simulator: 45 calculation and simulator unit tests (20 existing + 25 added) and 10/10 browser checks. Mentor journey 23/23. Fixed: ₹0 expense accepted, unrounded rent change, job-transition gap commitments not shown. Remaining: the gap month isn't modelled numerically, and PWA install is unverified. | P2 |
| AI-native value and supporting evidence | 10 | 6 | 6 | Real Groq agent with claim-level structured output. Existing reports show 8/8 connectivity checks and 1–4 of 8 (7 recorded runs) fixture answers passing the gate. AI value over a calculator is argued, not user-validated, and at least half of AI answers (4–7 of 8 per run) fell back to the rule-based guide in the recorded runs. | P1 |
| Evaluation-gate and golden-set evidence | 15 | 8 | 8 | The gate is real, fail-closed and documented, with 250+ tests and real-output regressions (PASS). **The golden set has 0 genuine human-labelled cases** (FAIL), and the Reliability panel reports this honestly. | P0 |
| User experience and accessibility | 15 | 9 | 13 | Before: 689 low-contrast text instances, 480 under 11 px, 177 small targets, 45 px overflow at 320 px. After: 0, 0, 50 (24 px source links and the dock toggle only) and 0. Not done: screen-reader testing, and an audit of the Dark Warm theme. | P2 |
| Production reliability and security | 10 | 6 | 6 → **8** after deployment | Build passes, 0 npm vulnerabilities, server-only secrets, no input logging, rate limiting and security headers. **Not deployed, no CSP, no lint or CI**, and all recent work is uncommitted. | P0 |
| User research and product iteration | 10 | 2 | 2 | Only engineering iterations are documented (gate and prompt versions). No user sessions, research or user-driven changes are evidenced. | P0 |
| Mentor testability and submission readiness | 5 | 1 | 1 → **3** after deployment | The mentor guide and demo checklist exist, but there is no public URL. A mentor would need local setup and their own Groq key. | P0 |
| **Total** | **100** | **58** | **64 → 68 after deployment** | | |

## Product strengths

1. **A trustworthy deterministic core.** Every figure is computed in TypeScript and labelled *entered by you* or *calculated by LifeFlow*. The reference case (₹30,000 − ₹18,000 − ₹3,000 = ₹9,000; ₹5,000 expense → ₹4,000) passes in unit and browser tests.
2. **A genuine evaluation gate.** Schema, arithmetic, claim-to-source, safety and uncertainty checks run before display. A check is never shown as passed unless it ran. The documented iterations show it blocking real wrong outputs.
3. **Safety by design.** Advice, injection, bank-rule and missing-context requests stop before the AI. The disclaimer appears on onboarding, Home and every answer.
4. **Honest evaluation surfaces.** The Reliability panel and reports separate human labels from fixtures and simulations and claim no accuracy.
5. **Polished, accessible UI after this audit.** WCAG AA contrast on the light themes, 11 px minimum text, no overflow from 320 px up, keyboard focus visible.

## Critical gaps

1. **No public deployment** (P0). Mentors cannot use the product without local setup.
2. **All recent work is uncommitted and unpushed** (P0). GitHub `main` is at `8e9b865` and lacks the Groq agent, gate, Reliability panel and every fix.
3. **No genuine target-user testing or research evidence** (P0). The Evidence Log CSV has 0 rows, and the Discovery Engine has 20 synthetic records.
4. **Golden set: 0 genuine human-labelled cases** (P0). Gate behaviour is evidenced; answer accuracy is not.
5. **The official Part 5 brief and rubric aren't available** (P1). Requirement coverage can't be confirmed against the official source.

## Assignment sources inspected

- `E:\NEXT LEAP\` and `Desktop\NEXT LEAP\`: Milestone 1–3 decks and an overview for a **different project** (ChatGPT Voice), two lecture handouts, and a generic Milestone 3 three-pager template. **No Part 5 brief or rubric was found.**
- `Downloads\groww_evidence_log.csv`: header only, **0 records**.
- `E:\NL DISCOVERY AI ENGINE\groww-sip-lab\groww_sip_lab.db` (read-only): 20 evidence records, all `is_synthetic=1`, with theme labels.
- The repository's own reports: `GROQ_*`, `AI_GATE_TEST_RESULTS.md`, `GOLDEN_SET_EVALUATION.md` and `PART5_*`.

## Verdict

**NOT READY.** The product itself is close to submission quality. The blockers are external deliverables and evidence: deployment, version control, user testing, a golden set and research.

See `FINAL_SUBMISSION_READINESS.md` for the ordered action list.
