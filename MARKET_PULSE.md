# Market Pulse

**Understand the market. Evaluate your options. Stay informed.**

Market Pulse is an additive feature in Groww LifeFlow (navigation item **Market Pulse**, URL `/#market-pulse`). It shows:
- the latest completed Indian trading session for NIFTY 50 and BSE SENSEX;
- a source-grounded AI verdict;
- a neutral SIP Decision Explorer;
- history, news and a deeper AI insight.

It is educational only. It makes no recommendations and executes nothing.

> ## What market data Market Pulse can legitimately show (researched 2026-11-07)
>
> No free source permits a public website to display **NIFTY 50**. Market Pulse therefore combines four permitted sources, and never estimates or scrapes anything:
>
> | Need | Source | What it gives | Can the AI cite it? |
> |---|---|---|---|
> | **SENSEX** | TradingView's free embeddable widget. BSE data is licensed for widgets; TradingView displays it under its own licence. | End-of-day quote in the hero, and a 1M–1Y chart | **No.** It is shown inside TradingView's frame; LifeFlow never reads it. |
> | **NIFTY 50** | None. NSE symbols are blocked in free widgets; NSE Indices requires a display licence. | An honest "not shown on this free site" card, linking to NIFTY 50 on TradingView | — |
> | **Market trend the AI can cite** | OECD SDMX API: India share prices, **monthly index (2015 = 100)**, CC BY 4.0 | Latest month, monthly, 3- and 12-month changes, and a 1–5 year chart | **Yes.** Verified, labelled as monthly and "not the NIFTY 50 or SENSEX level". |
> | **News** | SEBI RSS and the GDELT Project (GNews optional) | Publishers' own headlines and links | **Yes**, with attribution; an index move only via a cited report |
>
> **Licensed mode is still built.** With written permission and `EODHD_API_TOKEN` plus `MARKET_DATA_LICENSE_CONFIRMED=true`, the hero switches to verified daily NIFTY 50 and SENSEX closes, as originally specified.

## Page structure (fixed order)

1. **Daily Market Brief (hero).** Shows:
   - the session date, "End-of-day data · not live" and freshness;
   - NIFTY 50 and SENSEX: close, previous close, point and % change, direction;
   - the AI verdict, with what remains uncertain;
   - evidence links and the last update time.
2. **Explore Your SIP Options**, directly below the hero:
   - Continue, Pause, Reduce and Stop, all computed deterministically;
   - inputs for salary, essentials, SIP, emergency savings, reduced SIP, additional expense and pause length;
   - updates instantly as inputs change, and never ranks or recommends an option.
3. **Historical Market Trends.** 1M, 3M, 6M and 1Y (only periods the data covers). A keyboard-readable chart, period change, high and low, and attribution.
4. **Verified Financial News.** The publishers' own headlines, publisher, date and link. Never written by AI.
5. **Expanded AI Market Insight** (expandable):
   - what happened, reported developments with citations;
   - volatility context and educational SIP implications;
   - uncertainties, the checks passed, and calculated one-year context.
6. **Educational disclaimer.**

## How it works

```
Licensed index source (EODHD, licence-gated) ─┐
SEBI RSS · GDELT · GNews (optional) ──────────┤
                                               ▼
     /api/market-pulse/refresh   (Vercel Cron: 18:30 and 20:30 IST Mon–Fri, 09:00 IST Tue–Sat catch-up; CRON_SECRET; Redis lock)
        1. fetch end-of-day closes (≈1 year) for NIFTY 50 and SENSEX
        2. verify: valid trading dates (no weekends or future dates; today only after 15:30 IST),
           no duplicates, plausible moves, change = close − previous, % = change ÷ previous × 100
        3. fetch news for the session window (failures tolerated)
        4. build evidence: verified facts (closes, changes, 1M/3M/6M/1Y statistics) + news items
        5. Groq (openai/gpt-oss-120b, strict JSON) via the existing lib/ai/groq.ts adapter (unchanged)
        6. Market Pulse gate → pass: AI brief | fail: deterministic verified-facts brief
        7. store the snapshot in Upstash Redis (persistent; not serverless memory)
                                               ▼
     /api/market-pulse   (public, read-only, CDN-cached 5 min)  →  Market Pulse page
```

- **Visitors never trigger AI or data calls.** They read the stored snapshot.
- **Weekends, holidays and repeat runs:** if the source's latest session hasn't changed, the stored brief is kept and the AI isn't re-run.
- **Freshness** is computed when the page is read:
  - *Latest session*;
  - *May be one session behind (or a market holiday)*;
  - *Stale: N weekdays behind*, with a notice that the figures are the last verified ones.
- **On any failure** (source error, failed verification) the previous verified brief stays. Nothing is replaced with estimates.

### AI safety gate (`lib/market-pulse/gate.ts`, separate from the AI Companion's gate, which is unchanged)

| Check | Rejects |
|---|---|
| Schema | Anything that isn't the exact structured output |
| Sources | Unknown source ids; fact claims without fact ids; context claims without a news id |
| Numbers | Any number not found in the verified facts, their dates, or the cited news |
| Direction | "Rose" or "gained" when the verified change is down, and the reverse (for named indices or the benchmarks collectively) |
| Dates | "Today", "yesterday", "live": the session must be named by its date |
| Causes | Causal wording ("due to", "amid", "driven by"…) unless a cited news item shares its key terms |
| Advice | Buy, sell, continue, pause or stop instructions; "buying opportunity"; "safest" |
| Predictions | Forecasts of rises, falls, recoveries or returns |
| Guarantees | "Guaranteed", "risk-free", "definitely" |
| Uncertainty | A missing uncertainty disclosure |

Rejected AI text is discarded: only the check names are stored.

**Live test** with real Groq on synthetic evidence (`lib/market-pulse/groq-live.test.ts`, opt-in), 2026-11-07:
- **First run: 0 of 3** passed. Every run exceeded the claim-count limit.
- **After stating limits in the prompt: 1 of 3** passed. Two were gate false positives:
  - "1 of 261 sessions": a verified figure that wasn't allowed;
  - a general "in a rising market…" explanation read as a session claim.
- **After fixing both (each now a regression test): 3 of 3** passed.

Those generations used synthetic data, so this shows the gate works with real model output. It is not an accuracy measure.

## Data-source decision (researched 2026-11-07)

| Source | Decision | Why |
|---|---|---|
| **TradingView widgets** (Single Quote, Symbol Overview) for `BSE:SENSEX` | **Used** | The widget docs list BSE as end-of-day "Stocks, Indices & Futures"; the widgets are free for non-commercial sites. TradingView policies §4: attribution must stay visible and unaltered, so it is never restyled; on dark surfaces it sits on a light pill for contrast. TradingView receives visitors' IP address and the page URL; the widgets set no cookies. |
| **TradingView `NSE:NIFTY`** | Not available | Widgets show "This symbol is only available on TradingView", meaning it isn't licensed for widgets |
| **OECD SDMX API**, `DSD_STES@DF_FINMARK`, IND.M.SHARE | **Used** | Free and keyless; CC BY 4.0 since July 2024, cited on the page. Monthly index, not a daily close. The OECD notes third-party material may need the owner's permission; the series is OECD-compiled. Switch it off with `MARKET_PULSE_OECD=false`. |
| **SEBI RSS, GDELT** | **Used** | Headline and link display is permitted; GDELT is credited |
| **EODHD** | Built, off until written permission | Its free plan is personal use only |
| **RBI DBIE** | Not automated | It has real daily NIFTY 50 closes, but no public API (the site uses token-gated internal calls) and runs about a week behind. A person can export it manually. |
| NSE, NSE Indices, BSE; Yahoo Finance; Google Finance; broker APIs | Rejected | They ban automated collection, require display licences, or only allow personal use. NSE also requires permission to link, so no links to nseindia.com are shown. |
| Investing.com widgets | Rejected | Display needs written permission |
| GitHub projects: `NSE-MCP` (browser imitation against NSE's internal endpoints, plus Yahoo) and `Indian-Stock-Market-API` (yfinance) | Rejected | They wrap the same prohibited sources. An open-source licence covers the code, not the data. |
| MiroFish and BettaFish (multi-agent prediction and social-listening frameworks) | Not applicable | They supply no market data, and MiroFish's purpose (forecasting) conflicts with Market Pulse's no-prediction rule |
| FRED, Alpha Vantage, Stooq, data.gov.in | Rejected | Copyrighted series, personal use only, redistribution banned, or stale data |

## Turning it on

**Works with no setup:**
- the SENSEX quote and chart (TradingView, loaded in the visitor's browser);
- the NIFTY 50 explanation;
- the SIP Decision Explorer.

**Before merging, one owner step:**
1. Create a free TradingView account.
2. Open the widget builder for Symbol Overview and Single Ticker with `BSE:SENSEX`.
3. Done on 2026-11-07: the builder's generated code was compared with `app/TradingViewWidget.tsx`. Same script URLs and the exact attribution ("SENSEX quote by TradingView", linking to TradingView's SENSEX page). LifeFlow keeps daily date ranges (1M–1Y), because the builder's default intraday ranges are empty for end-of-day BSE data.

**For the daily AI brief** (OECD and news; no licence needed):
1. In Vercel, connect **Upstash for Redis** (Storage → Marketplace). This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. Set `CRON_SECRET` (at least 16 random characters). `GROQ_API_KEY` is already set.
3. Deploy, then run the first refresh (or wait for the 18:30 IST job):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://groww-lifeflow.vercel.app/api/market-pulse/refresh
```

**Optional: licensed daily closes.** With written permission from EODHD (or a licence from NSE Indices and BSE), set:
- `EODHD_API_TOKEN`;
- `MARKET_DATA_LICENSE_CONFIRMED=true`;
- `MARKET_DATA_ATTRIBUTION`.

The hero then shows verified NIFTY 50 and SENSEX closes.

**If a Content-Security-Policy is added later** (it is on the separate `level-up-evidence-tooling` branch), allow:
- `script-src https://s3.tradingview.com`;
- `frame-src https://www.tradingview-widget.com https://s.tradingview.com`.

## Automatic daily updates

After the one-time setup, Market Pulse refreshes itself every trading day. It needs no Claude Code, manual edits, commits or redeploys.

### Scheduler evaluation

The project's plan couldn't be read from this machine (no Vercel CLI or project link), so the design fits the **Hobby** limits, which also work unchanged on Pro.

| Option | Verdict |
|---|---|
| **Vercel Cron Jobs** (`vercel.json`) | **Used.** Generally available on all plans. Hobby allows up to 100 jobs per project, each running at most once a day, triggered anywhere within the scheduled hour (±59 min). That suits a once-a-day market brief. There are no automatic retries, which is why extra jobs follow. |
| Vercel Schedules | Not used. It's the successor (Hobby: every 15 minutes or slower, 15-minute jitter), but still in **public beta**. Switch to it if Cron Jobs are retired. |
| External schedulers (GitHub Actions cron, cron-job.org) | Not needed. They would also need `CRON_SECRET` stored outside Vercel. Any of them can call the same endpoint with the same header. |

**Schedule** (all UTC; India has no daylight saving):

| Cron | IST | Purpose |
|---|---|---|
| `0 13 * * 1-5` | 18:30–19:29, Mon–Fri | Main run after the 15:30 close, once end-of-day data has settled |
| `0 15 * * 1-5` | 20:30–21:29, Mon–Fri | Retry: late data, or a failed or facts-only first run |
| `30 3 * * 2-6` | 09:00–09:59, Tue–Sat | Next-morning catch-up if both evening runs failed |

### What each run does, and its safeguards

| Situation | Behaviour |
|---|---|
| **Unauthorised call** | 401. Requires `Authorization: Bearer <CRON_SECRET>`, compared in constant time. Vercel Cron sends it automatically. |
| **Overlapping runs** (cron plus manual) | A Redis lock (`SET NX PX 90 s`, released only by its owner) lets one run work; the other returns **409 skipped**. A crashed run's lock expires by itself. |
| **New trading session** | Fetch both indices in parallel → verify → news (15 s cap) → Groq (25 s cap) → gate → store. Total stays under the 60 s function limit. |
| **Weekend, holiday, repeat run** | Same session and closes as stored → **unchanged**. No AI call; the stored brief stays. |
| **AI fails for a new session** | The new **verified** figures are stored with a facts-only brief. The next run retries the AI, and only a passing AI brief replaces it. |
| **AI retry fails again** | The stored brief is kept. A facts-only brief never replaces an AI brief for the same session. |
| **Source returns an older session** | Never overwrites a newer stored brief. |
| **Source error, quota, bad data, failed verification** | **failed**. Nothing is written; the previous verified brief stays visible with its real date. The page shows that the latest refresh didn't complete. |
| **Licence not confirmed** | No index request is made at all. The run is recorded as failed with the reason. |

**Logging.** Each run writes one JSON line to the Vercel function logs with status, session date, brief type, failed check ids, news count and duration. It contains no inputs, AI text or secrets. Runs are also recorded in Redis: a status record and the last 30 runs.

**What visitors see.** The trading-session date, **Last successful update** (when the figures last changed) and **Last checked** (when the job last completed). If the latest run failed, a notice says these are the last verified figures.

### Operations

- **Trigger a run manually:**

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://groww-lifeflow.vercel.app/api/market-pulse/refresh
  ```

  Add `?force=1` to rebuild the same session. It can upgrade a brief, never downgrade one.
- **Responses:** `200` updated or unchanged; `409` another run in progress; `502` failed (previous brief kept; `previousKept` names its session); `503` not configured.
- **Check health:** the Vercel dashboard → Logs (search `market_pulse_refresh`), or Settings → Cron Jobs. The page's **Last checked** time should be from the most recent weekday evening.
- **Vercel Cron runs only on Production deployments.** Previews never refresh.

## Tests

| Suite | What it covers |
|---|---|
| `lib/market-pulse/sip-explorer.test.ts` (20) | ₹30,000 − ₹18,000 − ₹3,000 = ₹9,000; paused ₹12,000 (+₹3,000); reduce; extra expense; decimals; negative cash; zero and invalid inputs; reduced SIP above current; neutral wording |
| `market.test.ts` (20) | Change and % arithmetic; IST; weekends; 15:30 cut-off; weekdays vs calendar days; freshness; verification failures; period statistics |
| `gate.test.ts` (25) | A grounded answer passes; 19 unsafe or wrong variants are blocked; live-output regressions; fallback never stores rejected text |
| `refresh.test.ts` (11) | Update, unchanged session, provider and verification failures, news failure tolerated, mismatched session dates; **older session never overwrites; AI retry upgrade; failed retry keeps the stored brief; no downgrade from AI; new session stored when AI fails; slow-news time cap** |
| `providers.test.ts` (8) | Licence gate; EODHD request and parse (token not leaked); SEBI date format; RSS, GDELT and GNews parsing; news window and de-duplication |
| `routes.test.ts` (7) | Licence-blocker message; empty and served states; cron auth; no fetch without licence; full refresh to store; unchanged rerun; **lock skip and release; run status on updated, unchanged and failed runs; previous brief kept unchanged on failure; Last checked on the page** |
| `scripts/market-pulse-e2e.cjs` (11 checks; TradingView's script is stubbed inside the test) | **Open-data mode: SENSEX widget with attribution, NIFTY 50 unavailable with no figures, no exchange links, labelled OECD chart.**  Navigation; exact section order; hero contents; explorer arithmetic and validation; chart keyboard reading; news; insight; stale and unavailable states; 320/375/768 px; mobile nav; no page errors. Uses synthetic data **inside the test only**. |
| axe-core | 0 WCAG 2.2 AA violations on Market Pulse in all three themes, with and without data, at 1440 and 375 px, including the real TradingView widgets |
| Open-data gate tests (`gate.test.ts`, +6) | An index move without a cited report is blocked; a NIFTY move citing a SENSEX-only report is blocked; OECD wording must match the verified monthly change; invented index levels are blocked |

## Limitations

- **NIFTY 50 is not shown**, and the AI can't quote SENSEX values, because the widget's data isn't readable. The AI describes the OECD monthly index and reported news only.
- **The OECD series is monthly** and arrives some days after each month ends. It is not the NIFTY 50 or SENSEX level.
- **Open-mode brief dates are the latest weekday.** Exchange holidays aren't verified, so a holiday's brief carries the holiday's date with the previous news.
- **TradingView controls the widgets** (look, availability, symbols). If BSE coverage changes, re-check the widget-docs markets page.

- **No live index data until a licence is in place** (the blocker above). The EODHD integration is tested against its documented format, not a real response.
- **Exchange holidays aren't listed.** One weekday behind is shown as "may be a market holiday", using the source's own latest date.
- **History is 1 year at most** on EODHD's free plan.
- **News relevance is keyword-based.** GDELT gives no summaries, so those items show the headline only.
- **The gate uses lexical rules.** It is fail-closed and tested, but it can't judge nuance the way a person can.
- **Data is cached in Upstash**, subject to the source licence's caching terms.
