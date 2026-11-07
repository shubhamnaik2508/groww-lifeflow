# Evaluation file format

The AI Reliability panel imports one JSON file:

```json
{
  "dataset": {
    "kind": "human-labelled | engineering-fixture | simulation",
    "name": "…",
    "created": "YYYY-MM-DD",
    "labelled_by": "optional",
    "description": "optional",
    "consent_and_provenance": "optional, recommended for human-labelled data"
  },
  "cases": [
    {
      "id": "unique-id",
      "question": "The user's question (max 600 characters)",
      "expected": "What a correct answer should contain or do",
      "expected_behaviour": "answer | abstain | clarify (optional)",
      "rationale": "Why that is the expected result",
      "provenance": { "labeller": "Name or role", "labelled_at": "YYYY-MM-DD", "source": "Where the label came from" },
      "profile": { "salary": 30000, "expenses": 18000, "sip": 3000, "sipDate": "2026-12-05" },
      "scenario": { "type": "expense | salary | rent | job | failure", "inputs": { "amount": "5000", "category": "Health", "frequency": "one-time" } }
    }
  ]
}
```

- `provenance` is required for every case when `kind` is `human-labelled`.
- Only `human-labelled` files count towards the "genuine labelled cases" figure. Fixtures and simulations are shown with a warning label and excluded.
- `label_scope: "theme_only"` marks labels that classify a theme rather than describe an expected answer (used for Evidence Log imports).
- `profile` and `scenario` are optional; without them, ₹30,000 salary, ₹18,000 expenses and ₹3,000 SIP are used and no scenario is applied.
- Do not include personal or account information.

## Files here

- `lifeflow-engineering-fixture.json` — **engineering fixture, not human labels.** It was written by an AI coding assistant to exercise the pipeline and the Reliability workflow. Its expected results restate LifeFlow's own design rules. It must not be reported as evaluation evidence or used to compute accuracy.

- `lifeflow-3-case-human-labels.json` — **human-labelled, 3 cases.** One case per behaviour (answer, abstain, clarify), each labelled by a different human tester (anonymised as Human tester 1–3) on 2026-11-08. Three cases demonstrate the workflow; they cannot establish accuracy.
- `../public/evaluation/lifeflow-3-case-review.json` — the same 3 cases with the live run (LifeFlow AI, Groq `openai/gpt-oss-120b`, prompt `lifeflow-agent-v3.2`) and the human review (overall outcome only; the five dimensions were not scored). The AI Reliability panel loads it with **Load published review**. The separate SIP Discovery Engine contains 20 evidence-theme fixtures for a different task; they are not assistant-answer labels and are not imported.
