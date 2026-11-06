# Market Pulse

**Understand the market. Evaluate your options. Stay informed.**

Market Pulse is an additive feature in Groww LifeFlow (navigation item **Market Pulse**, URL `/#market-pulse`). It shows:
- the latest completed Indian trading session for NIFTY 50 and BSE SENSEX;
- a source-grounded AI verdict;
- a neutral SIP Decision Explorer;
- history, news and a deeper AI insight.

It is educational only. It makes no recommendations and executes nothing.

> ## ⚠ Blocker: index data needs a licence for public display
>
> Research on 2026-11-07 (details below) found **no free source whose terms allow showing NIFTY 50 and SENSEX values on a public website**:
> - NSE, NSE Indices and BSE prohibit automated collection and charge for display licences.
> - The free API tiers checked are all personal or non-display use: EODHD, Twelve Data, Alpha Vantage, FMP, Marketstack and Finnhub.
> - Yahoo's unofficial endpoints and broker APIs are not permitted for this.
>
> So **Market Pulse ships with index data switched off.** Until a licensed source is enabled:
> - the Daily Market Brief states the blocker and shows **no figures**;
> - historical and news sections stay empty, because they come with the daily refresh;
> - the SIP Decision Explorer works fully.
>
> Nothing is estimated, sampled or scraped.

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

| Need | Decision | Why |
|---|---|---|
| NIFTY 50 and SENSEX values | **EODHD, only after written permission** (`MARKET_DATA_LICENSE_CONFIRMED=true`) | The free plan has 20 calls a day and 1 year of end-of-day history, which fits (≈4 calls a day). Its terms make the free plan personal use and forbid public display, so written permission is needed. Tickers `NSEI.INDX` and `BSESN.INDX` are not yet verified with a real key. |
| Rejected | NSE, NSE Indices and BSE files or pages; Yahoo; Kite, Upstox, Dhan and Angel One; Twelve Data, Alpha Vantage, FMP, Marketstack and Finnhub free tiers | These sources ban automated collection, require a paid display licence, or are personal or non-display use only |
| News | **SEBI RSS** (official; linking needs no permission, though SEBI asks to be informed) and **GDELT** (open use, must cite GDELT: done in Evidence) | Both are free and permitted for headline and link display |
| News, optional | **GNews** (`GNEWS_API_KEY` and `GNEWS_USE_CONFIRMED=true`) | Free plan is "non-commercial use". Confirm with contact@gnews.io that a public student site qualifies. |
| Not used | ET, Mint and BusinessLine RSS; RBI deep links; NewsAPI.org free plan | Personal use or prohibited display; RBI requires permission for links; NewsAPI's free plan is development only |

## Turning it on

1. **Get permission for index data.**
   - Email EODHD (sales@eodhistoricaldata.com). Ask to display two end-of-day index closes and a 1-year chart on a free, non-commercial educational site, with attribution.
   - Or obtain an end-of-day display licence or waiver from NSE Indices and BSE.
   - Keep the reply.
2. **Storage.** In Vercel, go to Storage (Marketplace) → **Upstash for Redis** and connect it to the project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Alternatively, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; the same values also enable the shared AI rate limiter.
3. **Environment variables** (Production; server-side; never use `NEXT_PUBLIC_`):
   - `CRON_SECRET`: at least 16 random characters. Vercel Cron sends it automatically.
   - `EODHD_API_TOKEN`: from the EODHD account.
   - `MARKET_DATA_LICENSE_CONFIRMED=true`: only once permission is in writing.
   - `MARKET_DATA_ATTRIBUTION`: the attribution text the licence requires.
   - Optional: `GNEWS_API_KEY` with `GNEWS_USE_CONFIRMED=true`; `MARKET_PULSE_GDELT=false` to switch GDELT off.
   - `GROQ_API_KEY` is already set. Without it, the deterministic brief is shown.
4. **Deploy, then run the first refresh** instead of waiting for the cron:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://groww-lifeflow.vercel.app/api/market-pulse/refresh?force=1"
```

5. **Check:**
   - `GET /api/market-pulse` returns `status: "ok"`;
   - the session date matches the exchange's latest session;
   - compare both closes with nseindia.com and bseindia.com.

See **Automatic daily updates** below for the schedule and how the job behaves.

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
| `scripts/market-pulse-e2e.cjs` (10 checks) | Navigation; exact section order; hero contents; explorer arithmetic and validation; chart keyboard reading; news; insight; stale and unavailable states; 320/375/768 px; mobile nav; no page errors. Uses synthetic data **inside the test only**. |
| axe-core | 0 WCAG 2.2 AA violations on Market Pulse in all three themes, with and without data, at 1440 and 375 px |

## Limitations

- **No live index data until a licence is in place** (the blocker above). The EODHD integration is tested against its documented format, not a real response.
- **Exchange holidays aren't listed.** One weekday behind is shown as "may be a market holiday", using the source's own latest date.
- **History is 1 year at most** on EODHD's free plan.
- **News relevance is keyword-based.** GDELT gives no summaries, so those items show the headline only.
- **The gate uses lexical rules.** It is fail-closed and tested, but it can't judge nuance the way a person can.
- **Data is cached in Upstash**, subject to the source licence's caching terms.
