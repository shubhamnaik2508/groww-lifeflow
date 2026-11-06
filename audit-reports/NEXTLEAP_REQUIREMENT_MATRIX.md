# NextLeap requirement traceability matrix (2026-11-07)

**Assignment source.** The official Part 5 brief was not found on this machine. The requirements below come from the project owner's audit and implementation briefs, which list the Part 5 expectations. Each should be re-checked against the official brief once it is available.

**Result: 6 PASS, 4 PARTIAL, 5 FAIL, 3 NOT VERIFIED (of 18).**

| # | Requirement | Source | Supporting evidence | Status | Missing evidence or defect | Required action | Priority |
|---|---|---|---|---|---|---|---|
| 1 | Clearly defined target segment | Owner brief | README, `GROQ_AGENT_ARCHITECTURE.md`: first-time salaried professionals aged 22–26, Tier 2 India, first SIP within 12 months | PASS | — | — | — |
| 2 | Research-backed problem statement | Owner brief | The problem statement is written | PARTIAL | No research backs it in the repo or on this machine | Attach interview, survey or review evidence | P0 |
| 3 | Evidence supporting the selected problem | Owner brief | Discovery Engine: 20 records, **all synthetic**. `groww_evidence_log.csv`: **0 rows** | NOT VERIFIED | Genuine evidence (quotes, counts, sources) | Collect and log genuine evidence with provenance | P0 |
| 4 | Functional AI-native MVP | Owner brief | Local production build; all suites pass (`MVP_FUNCTIONAL_TEST_RESULTS.md`); Groq agent documented | PARTIAL | Works only locally | Deploy (#12) | P0 |
| 5 | Signature Life-to-SIP Scenario Simulator | Owner brief | Five events; 45 calculation and simulator unit tests; 10/10 simulator browser checks; reference ₹9,000 → ₹4,000 | PASS | — | — | — |
| 6 | AI Companion implementation evidence | Owner brief | `GROQ_AGENT_ARCHITECTURE.md`, `GROQ_API_TEST_RESULTS.md` (8/8 connectivity) | PASS | — | — | — |
| 7 | Evaluation-gate evidence | Owner brief | `AI_GATE_TEST_RESULTS.md`; gate code; real-output regressions | PASS | — | — | — |
| 8 | Safe-fallback evidence | Owner brief | Provider-error and gate-failure tests; outage browser test | PASS | — | — | — |
| 9 | Golden-set measurement evidence | Owner brief | Runner and panel work; runs on engineering fixtures only | FAIL | **0 genuine human-labelled cases** | Create a 20–50 case human-labelled set and run it | P0 |
| 10 | AI-versus-non-AI justification | Owner brief | Reasoned in `UX_AND_PRODUCT_REVIEW.md` and the architecture doc | PARTIAL | No user evidence that AI explanations beat the rule-based guide; at least half of AI answers fell back in recorded runs | A/B or think-aloud comparison with 3+ users | P1 |
| 11 | Investment-advice disclaimer | Owner brief | Onboarding, Home footer and every answer; exact required wording; browser-tested | PASS | — | — | — |
| 12 | Public production deployment | Owner brief | Vercel-ready configuration (`DEPLOYMENT.md`) | FAIL | No deployment or URL | Deploy with approval and verify the URL | P0 |
| 13 | Mentor can attempt a real task | Owner brief | Mentor guide and demo checklist; local journey passes | NOT VERIFIED | No public URL; no mentor attempt | After #12, a mentor runs `MENTOR_DEMO_CHECKLIST.md` | P0 |
| 14 | Genuine target-user testing (3 or more) | Owner brief | Protocol and template provided (`USER_TESTING_PROTOCOL.md`) | FAIL | No sessions conducted | Run 3–5 sessions with eligible users | P0 |
| 15 | Documented product iterations | Owner brief | Engineering iterations (prompt v1 → v3.2, gate fixes, this audit's fix log) | PARTIAL | No iteration driven by user feedback | Record changes made after user sessions | P1 |
| 16 | Public AI Discovery Engine | Owner brief | GitHub repo `groww_sip_discovery_AI_engine`; Vercel instructions committed | NOT VERIFIED | No public URL found; data is synthetic | Confirm or deploy the URL; load genuine evidence | P1 |
| 17 | Separate AI Evidence Log | Owner brief | Discovery Engine evidence tables; `groww_evidence_log.csv` export | FAIL | The log contains no genuine records (20 synthetic; CSV 0 rows) | Populate with genuine evidence and export | P0 |
| 18 | Final presentation and submission artefacts | Owner brief | Generic three-pager template only | FAIL | No LifeFlow deck or three-pager found | Prepare a deck or three-pager using these reports | P1 |
