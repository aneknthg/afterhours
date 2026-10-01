# Afterhours — 12-Month Financial Model (2026-06-22, v3)

Companion workbook: `afterhours-financial-model-2026-06-22.xlsx` (same folder). Open it in Excel, Numbers, or Google Sheets — every number flows from the **Assumptions** tab, so changing any input cell recalculates the whole model.

**v2 update (same day):** added two new acquisition channels — paid creator partnerships and r/girlshangouthyd host sponsorships — on top of the original organic/generic-paid model. See "Creator partnerships vs. host sponsorship" below for the analysis and updated headline numbers.

**v3 update (same day):** restyled the workbook to standard FP&A/banking convention instead of the original colorful dashboard look — blue font for hardcoded inputs, black for same-sheet formulas, green for links pulling from another tab; thin borders and underlines instead of color-filled section blocks; long explanations moved into cell comments (hover any label with a small red corner marker) instead of paragraph rows. The "Dashboard" tab is now **Summary**. No formulas or numbers changed — verified identical Year 1 totals before and after the restyle.

**v4 update (2026-07-01) — audit + real-data recalibration:** audited the workbook (formula-level + full model-integrity pass) and recalibrated three behavioral assumptions and the Month-0 baseline against **real prod Supabase data** pulled for the Rory Sutherland marketing review. Six input cells changed on the `Assumptions` tab; every formula and all downstream logic are unchanged. Audit conclusions and the changes:
- **Model integrity is clean.** No `#REF!`/`#VALUE!`/`#DIV/0!` anywhere; the Balance Sheet balances to the rupee (balance-check row = 0) in all 12 months, before and after the changes — independently reverified by a from-scratch recomputation of all 10 tabs.
- **Baseline was stale:** Month-0 actuals moved from 56/23/5 (2026-06-23) to the real **65 signups / 26 verified / 6 active** (2026-07-01).
- **Verification rate on new signups** `C22`: 0.46 → **0.40**. The old rate counted only people who *attempted* verification; the real signup→verified conversion is 26/65 = 40%, because **55% of signups never attempt verification at all** (the review's central funnel finding).
- **Activation rate** `C43`: 0.50 → **0.23**. Real activation is 6 active / 26 verified = 23%; the 50% had no data behind it.
- **Events attended / active / month** `C44`: 3.0 → **1.0**. 3/mo was an aspirational steady state "once there's real supply" — supply has collapsed (17 events ever, 3 in the last 30 days, 0 in the last 7). Observed is ~19 RSVPs across 6 active users over the app's life ≈ ~1/active/month.
- **One caveat flagged (fixed in v5 — see below):** the `LTV : CAC` line divided a *per-active-user* LTV by a *per-verified-user* CAC (a units mismatch) that overstated the ratio.

**v5 update (2026-07-01, same-day follow-up) — men-adjustment, LTV:CAC fix, modest optimism:** three further changes on top of v4, per founder input:
- **LTV:CAC units mismatch fixed in the workbook.** `Unit Economics & Break-Even` rows 15–16 now put both sides on a per-verified-user basis (LTV × activation rate ÷ CAC; payback likewise activation-adjusted). This is a real formula change, no longer just a flag. The honest ratio is **~0.65x** — i.e. a verified user's expected lifetime gross profit is currently *below* the cost to acquire them, which is expected pre-monetization (payments aren't live). The old broken formula would have printed ~2.2x for the same inputs.
- **Verification rate raised 0.40 → 0.50** (`C22`). The 40% denominator included ~10 men who signed up on the cold Reddit post, never completed verification, and never will (not the target user). Stripping them, the real *women* signup→verified rate is 26/55 ≈ **47%**; set to 50% to add a modest uplift from women-targeted marketing over a single generic Reddit post. Attempters still pass ~90%, so 50% stays conservative.
- **Activation raised 0.23 → 0.30** (`C43`) and **organic Month-1 signups 20 → 25** (`C17`) — modest optimism reflecting the shipped onboarding-copy change and better reach than one cold post. Deliberately kept well below the original unfounded 50% activation / higher-growth figures. **Events/active/month left at 1.0** — event supply is genuinely the weakest signal (0 events in the last 7 days), so it was not made more optimistic.
- Balance Sheet still balances to 0 in all 12 months after these changes (reverified from scratch).

**v6 update (2026-07-01) — phased app + push-notification engagement uplift:** the model previously applied one flat set of engagement rates for all 12 months, but the product reality is a transition: the **website has been live under a month**, and the **iOS app launches within ~2–3 weeks**. Users are materially more active in apps than on mobile web, and push notifications (hard to do on web, easy in-app) are the strongest retention lever there is — so activity should *step up* a couple of months after the app lands, not stay flat. Added a phased mechanism (new `Assumptions` block, rows 89–93) that switches three rates from a website-era value to a higher post-app value starting **Month 3** (~2 months after the Month-1 app launch):
  | Rate | Website-era (Months 1–2) | Post-app + push (Month 3+) | Uplift | Benchmark it's discounted from |
  |---|---|---|---|---|
  | Activation (verified→active) | 0.30 | **0.38** | +27% | apps convert ~3x, retain ~1.5–1.6x vs web |
  | Events / active / month | 1.0 | **1.4** | +40% | apps ~2x session frequency; push drives repeat use |
  | Monthly churn | 0.25 | **0.22** | −12% | push-opted-in users retain ~2–3x vs none |
  Each uplift is deliberately set **well below** what the app-vs-web and push-notification research would justify (sources below), discounted hard for a single-city, early-stage app with unproven execution. Even so, Month-12 active users rise from ~256 (flat) to **~355** — a clear app effect that still lands *below* the over-optimistic v2 figure (382) we corrected down from, so this is "a bit optimistic, not a round-trip." The uplift is gated on a single assumption cell (`C90`) — if the app slips or push adoption disappoints, change that one month and everything re-phases. Balance Sheet still balances to 0 in all 12 months.

  *Research anchors:* apps capture ~90% of mobile time and ~2x session length vs mobile web; 90-day retention ~25–32% (app) vs ~15–20% (web); users who receive push in their first 90 days retain ~3x better than those who don't. See Sources at the end of this file.

**v7 update (2026-07-01) — referral / network-effect loop:** the model previously had *purely exogenous* growth — every signup came from a channel (organic/paid/creator/sponsorship), and nothing grew *because* existing users were there. That's a real gap for a social/events app. Added a referral loop: each active user drives **0.20 new signups/month** via word-of-mouth (`Assumptions!C96`, ~2.4 signups/active/yr, ₹0 acquisition cost), feeding the same verification→activation funnel (`Users & Growth` row 11). The loop is **sub-critical** (it amplifies growth but doesn't run away — no hockey-stick), which is realistic at this scale. Effect: Month-12 verified users **2,276 → 2,518**, active **355 → 403**, and blended CAC falls (referral signups are free), nudging LTV:CAC to ~0.82x. **Caveat, stated plainly:** there is *no referral data yet* — the current base came from one cold Reddit post and word-of-mouth hasn't visibly kicked in, so 0.20 is a moderate estimate, not a measured fact. It's gated on one cell (`C96`); set it to 0 to strip the network effect entirely. See the referral sensitivity table under the headline below.

**Note:** the `.xlsx` ships with formulas but no cached values — open it in Excel/Sheets/Numbers once and it recalculates. The headline numbers below (the **v7** column) were produced by a faithful from-scratch recomputation that reproduces the prior (v2) run to within rounding, so they can be trusted without opening the file.

## Tabs

1. **Summary** — headline metrics in a plain table + two charts (user growth, revenue vs. opex) + notes
2. **Assumptions** — every editable input, organized by section, with context on hover (cell comments)
3. **Users & Growth** — monthly signup → verification → activation → retention funnel
4. **Revenue Model** — commission, subscription, sponsorship, by stream
5. **Income Statement** — monthly P&L, Year 1 total column
6. **Cash Flow** — monthly cash flow + founder-loan draws
7. **Balance Sheet** — monthly, balances to the rupee (see methodology below)
8. **Unit Economics & Break-Even** — ARPU, CAC, LTV, payback, break-even gap
9. **Financial Ratios** — burn, LTV:CAC, burn multiple, founder funding required
10. **Cap Table** — 5 founders + ESOP pool

## Starting point (Month 0, actuals as of 2026-06-22, refreshed 2026-06-23)

From the Reddit soft-launch ("we built a women-only app... it's empty, come help us start it off"): originally 48 total signups, 22 verified (45.8%), 0 active users, 0 events, ₹0 spent (fully organic).

**Update (2026-06-23):** traction baseline refreshed in the `Assumptions` tab (`C10`, `C11`, `C13`) — **56 total signups, 23 verified (41.1%), 5 active users** (by the model's own activity definition: at least one of RSVP'd, hosted an event, or sent a chat message; excludes the admin and QA-test accounts). The first real community event ("Bedazzling Divas," hosted by an organic Reddit signup) went live, drawing 4 RSVPs and 5 distinct chat participants — the first real signal against the #1 risk flagged below ("zero events against 22 verified users"). No other assumptions changed.

**Update (2026-07-01):** baseline refreshed again to real prod data — **65 total signups, 26 verified (40%), 6 active users** — and the Headline outputs table below has now been **fully recalculated** against it (all 10 interlinked tabs recomputed from scratch; see the v4/v5 notes above). Alongside the baseline, the funnel rates were reset to observed reality and then modestly adjusted (verification 46%→**50%** after stripping ~10 non-converting men and adding a small marketing uplift; activation 50%→**30%**; events/active 3→**1**; organic 20→**25**/mo). The pre-2026-07-01 rows in the Headline table are retained for comparison but are superseded by the **v5 (real-data)** column.

Month 1 of the forecast begins from this baseline.

## How the assumptions were set

Every input below came directly from you; where you said "use an industry benchmark" or gave a range, the choice and reasoning is noted.

**Team & costs**
- 5 founders, unpaid for the full 12 months.
- 2 designers + 1 financial analyst at ₹20,000/month each, starting Month 1.
- Growth/marketing hire (₹20,000/month) starts Month 3; community/ops hire (₹20,000/month) starts Month 6 — staggered as you specified.
- Other recurring opex (tools/domain/misc): ₹3,500/month.
- Incorporation: ₹20,000 already paid, process underway — booked as a pre-Month-1 sunk cost.
- $25,000 YC AI Stack credit (≈ ₹20.75L at ₹83/$1) covers AWS, Supabase, and AI/LLM costs only — modeled as a non-cash, self-offsetting grant (see Balance Sheet methodology), **not** available for salaries or marketing.

**Growth & acquisition** — now four channels, all feeding the same funnel. Funnel rates were recalibrated to real prod data on 2026-07-01, then adjusted for the ~10 men who won't convert and a better-than-cold-Reddit marketing funnel: verification **50%** (real women rate ~47%; was 46% orig / 40% pre-adjustment), activation **30%** (real 23%; was 50% orig), churn 25%/mo:
- **Organic**: baseline **25** signups/mo (was 20), +8% MoM, ₹0 cost.
- **Generic paid**: ₹20,000/month (ads + campus ambassadors) at a blended CAC of ₹150/verified user (Months 1-2) improving to ₹100/verified user from Month 3 once the growth hire is running it.
- **Creator partnerships** (new in v2): ₹6,000/deal (midpoint of a ₹5-7k range for 10-20k-follower local creators), starting Month 2, generating an estimated 33 signups/deal. 1 deal/month through Month 5, ramping to 4 deals/month from Month 6 — matches "start with 1-2, then increase to 3-4."
- **r/girlshangouthyd host sponsorship** (new in v2): ₹4,500/event (midpoint of ₹4-5k), 2 sponsored events/month from Month 1, generating an estimated 20 signups/event.
- Both new channels are **in addition to**, not a replacement for, the generic ₹20k/month budget, per your call.
- **Events attended per active/month: 1.0 in the website-era months, stepping up to 1.4 from Month 3** once the app + push notifications are live (v6 phased uplift). The 1.0 base was recalibrated 2026-07-01 from real usage (~19 RSVPs across 6 active users over the app's life; was a flat aspirational 3/mo); 10% of actives host an event.
- **Engagement uplift (v6):** activation, event-frequency and churn all improve from Month 3 to reflect the app launch (~Month 1) and push notifications maturing ~2 months later — activation 0.30→0.38, events/active 1.0→1.4, churn 0.25→0.22. All three are gated on one cell (`Assumptions!C90`, the uplift-start month) so the whole app effect re-phases if the launch slips.
- Second city launches Month 7 with a ₹75,000 one-time push and a 15% uplift to organic/generic-paid signups thereafter (the two new channels are unaffected by this uplift — they're deal-driven, not ad-spend-driven).

**Revenue (you chose commission + subscription + sponsorship)**
- Commission: 17.5% (midpoint of your 15-20% range) on an assumed 15% of events being paid, at an average ₹400 ticket — **flagged explicitly as a placeholder**, since you said it's too early to know the real paid-event mix.
- Subscription: ₹249/month (midpoint of ₹199-299), launching Month 4, adoption ramping from 2% to 8% of active users by Month 12.
- Sponsorship: ₹0 through Month 6 as instructed, then 1 deal/month at ₹10k (Months 7-9), 2 deals/month at ₹12k (Months 10-12).

**Funding**
- Cash on hand: ₹0. The pre-seed round currently in conversations is **deliberately excluded from the base case** (you asked for the organic-only/self-funded view) — see "Founder funding required" below for what that implies.
- Cap table: 10% ESOP pool, remaining 90% split equally across the 5 founders (18% each).

## Creator partnerships vs. host sponsorship — the analysis

**r/girlshangouthyd host sponsorship is the stronger idea.** It buys into events that already have proven demand — you're not creating attention from nothing, you're funding supply that was going to exist anyway and routing it through Afterhours. That matters for two reasons specific to this company: today the real bottleneck isn't signups (you have 22 verified users sitting idle), it's that there are **zero events** — and per the Core IP audit done a few days ago, the verified co-attendance/trust graph is the one structurally defensible asset in the build. A sponsored event with app-routed, verified RSVPs feeds that graph directly; a cold signup with no event attached does not. The real execution risk is enforcement — the sponsorship only pays off if RSVPs are required to go through the app, not WhatsApp as usual.

**Creator partnerships are reasonable but weaker on their own.** By the model's own numbers, a creator deal is actually slightly *cheaper* per raw signup than a sponsored event (~₹182 vs. ~₹225) — but those signups arrive with no event attached, so they risk landing in the same zero-activity hole the current 22 verified users are in. The strategic fix, not yet reflected in the spreadsheet mechanics: have creators host or co-host a *sponsored* event rather than just post about the app, so the channel produces supply too.

**Recommendation:** lead with host sponsorship from Month 1 (as modeled), treat creator deals as a smaller pilot, and track signup → verify → first-RSVP conversion separately per channel so you can kill or double down on whichever actually performs once real data exists — the per-deal signup numbers in the model (33 for creators, 20 for sponsorship) are estimates with no data behind them yet.

## Headline outputs (base case, v2 — with both new channels)

| Metric | v1 (2026-06-22 AM) | v2 (2026-06-22 PM, +2 channels) | **v7 (2026-07-01, real data + app uplift + network effect)** |
|---|---|---|---|
| Verified users, Month 12 | ~1,338 (cumulative) | ~2,045 (cumulative) | **~2,518** (cumulative) |
| Active users, Month 12 | ~239 | ~382 | **~403** |
| Year 1 total revenue | ~₹1.85L | ~₹2.29L | **~₹1.79L** |
| Year 1 total acquisition/marketing spend | ~₹2.4L | ~₹5.4L (₹2.4L generic + ₹1.92L creator + ₹1.08L sponsorship) | **~₹5.4L** (unchanged — spend inputs untouched) |
| Year 1 total operating expenses | ~₹14.17L | ~₹17.17L | **~₹17.17L** (unchanged) |
| Year 1 net loss | ~₹12.4L | ~₹15.0L | **~₹15.4L** |
| **Founder funding required through Month 12** | ~₹12.6L | ~₹15.2L | **~₹15.6L** (incl. the ₹20k incorporation) |
| LTV : CAC (Month 12, activation-adjusted) | ~3.8x | ~1.7x | **~0.82x** (units now fixed — honest) |
| Burn multiple (Year 1) | ~6.7x | ~6.5x | **~8.6x** |
| Break-even (monthly cash-flow-positive) | Not reached within 12 months | Not reached within 12 months | **Not reached within 12 months** |

**Referral / network-effect sensitivity (v7 lever `Assumptions!C96`):** the base case bakes in the *moderate* row. The loop is sub-critical, so the swing is bounded within 12 months:

| Referral rate (signups/active/mo) | Verified M12 | Active M12 | Each active user invites |
|---|---|---|---|
| 0.00 (no network effect) | ~2,276 | ~355 | — |
| 0.10 (light) | ~2,392 | ~378 | ~1.2 signups/yr |
| **0.20 (moderate — base case)** | **~2,518** | **~403** | **~2.4 signups/yr** |
| 0.35 (optimistic) | ~2,727 | ~446 | ~4.2 signups/yr |

**What the v7 numbers mean, in plain terms:** the funnel steps that turn signups into revenue were first corrected to observed reality (v5), then given a **phased app/push uplift** from Month 3 (v6), and finally a **moderate referral loop** on top (v7). Net effect versus v2: Month-12 active users are slightly higher (382 → 403) but for well-grounded reasons this time (real conversion in the website-era months, then app + word-of-mouth), and Year-1 revenue is ~22% lower (₹2.29L → ₹1.79L) because the corrected conversion rates dominate the first half of the year. Costs are unchanged, so **founder funding required (~₹15.6L) is essentially the same as v2's ₹15.2L** — funding is opex-driven, and both the engagement uplift and the network effect move revenue/signups, not cost. The **burn multiple is ~8.6x** (down from v5's ~10.7x, as the app uplift and free referral signups add revenue against the same spend). The **LTV:CAC is ~0.82x** on the fixed like-for-like basis — still below 1x (a verified user isn't yet worth her acquisition cost while payments are off), but trending up: it crosses 1x as monetization turns on and the app/push/referral effects compound. Two levers still dominate everything: **closing the signup→verification drop-off**, and **turning on payments** so the revenue lines stop being aspirational.

**The trade-off in plain terms (v2-historical — superseded by the v5 interpretation above; retained for the channel-comparison logic):** the two new channels cost ~₹3L more in founder funding over the year but produce ~53% more verified users and ~60% more active users by Month 12 than the v1 base case — and unlike generic ads, a meaningful share of those users arrive already attached to a real event. The cost is that blended LTV:CAC at Month 12 drops from ~3.8x to ~1.7x, because total acquisition spend more than doubles (₹53,000/month by Month 12 vs. ₹20,000/month in v1) while per-channel signup-to-LTV economics are still unproven estimates, not real data. **Founder funding required (~₹15.2L over the year)** is still the single most important number — cash on hand is ₹0 and the model doesn't assume the pre-seed closes, so this entire amount has to come from the 5 founders' pockets or an earlier-than-planned raise. The $25k YC credit doesn't touch this number; it only covers infra.

## Balance sheet methodology (why it balances)

YC AI Stack credits are treated as an **in-kind deferred grant**: received as both an asset (YC credit remaining) and a matching liability (deferred grant), and as infra is consumed each month, the model recognizes equal and offsetting "grant income" and "infra expense" lines in the P&L — net zero cash/profit impact, while the asset and liability both shrink together. Any operating shortfall is covered by a "Due to founders" loan that keeps cash at exactly ₹0. This keeps Assets = Liabilities + Equity in every single month (verified to within floating-point rounding via independent formula evaluation — see the "Balance check" row on the Balance Sheet tab, which reads 0 throughout).

## Key risks / what to revisit first

1. **The #1 lever is upstream, not revenue: the signup→verification drop-off.** Every downstream number is capped by this. Part of the raw 55%-never-verify figure is ~10 men who signed up and abandoned (now accounted for — the go-forward rate is set to 50% on a women basis), but a real drop-off among target-user women remains. Closing it (the exact thing the review's onboarding-copy change targets) moves the model more than any pricing or channel tweak, and the 90% attempt-level pass rate is the ceiling to aim for.
2. **The paid-event assumptions (15% paid, ₹400 ticket, 17.5% commission) are guesses — and payments aren't built yet.** Commission revenue is booked from Month 1, but the Razorpay/escrow payment stack is designed, not shipped, so real commission is ₹0 until it goes live. Treat all commission revenue before payments launch as aspirational, and replace the placeholders with real numbers the moment the first few paid events run.
3. **Activation and event-frequency are grounded in observed reality (30% activation, 1 event/active/mo).** Activation is the real 23% plus a modest lift for better onboarding/targeting; event-frequency is left at the observed ~1/active/mo and was deliberately *not* made optimistic, because hosting has stalled (0 events in the last 7 days). Both replaced the old 50% / 3-per-month figures that had no data behind them. Revise event-frequency upward only when real supply recovers.
4. **The creator (33/deal) and sponsorship (20/event) signup estimates still have zero real data behind them.** Tighten both after the first 2-3 deals/events actually run, and track signup→verify→first-RSVP conversion per channel separately — don't keep scaling spend on a channel that isn't converting.
5. **Host sponsorship only works if RSVPs are required to go through the app.** Otherwise you're paying ₹4-5k for an event that runs on WhatsApp as usual, with no signups or trust-graph data to show for it — make that condition explicit before the first sponsorship conversation.
6. **Founder funding required (~₹15.6L) is a real number, not a modeling artifact.** If none of the 5 founders can personally cover this and the pre-seed doesn't close early, headcount/marketing/creator/sponsorship spend will need to be cut back from what's modeled here.
7. **`LTV : CAC` is now fixed and reads ~0.82x — take it at face value.** The old formula flattered it by dividing per-active LTV by per-verified CAC; it's now activation-adjusted (per-verified on both sides). Below 1x means a verified user isn't yet worth what she costs to acquire — expected while payments aren't live and commission is ~₹0. It trends toward 1x as monetization turns on and the app/push/referral effects compound; watch it as the primary "is the model working" signal.
8. **Burn multiple is ~8.6x, not ~6.5x** — the honest figure once revenue reflects observed conversion (the app uplift and free referral signups pull it down from v5's ~10.7x). Not fatal this early, but it's the number that should drive urgency on the verification drop-off (risk 1) and on delaying spend until conversion is proven.
9. **The v6 app/push uplift is a forecast, not a fact — contingent on the app launching on time and push adoption landing.** It phases in from Month 3, gated on one cell (`Assumptions!C90`). If the app slips, push opt-in disappoints, or users don't migrate off the website, push `C90` out (or lower `C91/C92/C93`) and the model re-phases. The uplifts are already discounted well below the app-vs-web and push benchmarks, but they still assume competent execution.
10. **The v7 network effect (0.20 referral signups/active/mo) has zero data behind it yet** — it's the most speculative input in the model. Word-of-mouth hasn't visibly kicked in (the base came from one cold Reddit post), so treat the ~2,518 verified / ~403 active figures as "if a modest referral loop takes hold." It's gated on `Assumptions!C96`; set it to 0 for a purely channel-driven view (~2,276 / ~355), and replace 0.20 with a measured rate the moment you can track invites→signups. The loop is sub-critical by design, so it won't manufacture unrealistic hockey-stick growth.

## How to update it

Open `afterhours-financial-model-2026-06-22.xlsx`, go to the **Assumptions** tab, and edit any blue-font cell — every other tab recalculates automatically (standard Excel formulas, no macros). Hover a row label for context — long explanations live in cell comments rather than on-sheet text. Suggested first edits once you have real data: verification rate on new signups, % of events that go paid, actual CAC by channel, actual monthly infra spend (to track against the $25k YC pool), and — after the app has been live a couple of months — the post-app engagement rates (`C91/C92/C93`) and their start month (`C90`), replacing the benchmark-derived estimates with your own measured app-vs-website activity.

## Sources — app vs. website engagement & push notifications (v6 uplift basis)

Benchmarks behind the phased app/push uplift (pulled 2026-07-01; all figures discounted before use):
- [MobiLoud — Mobile Apps vs Mobile Websites (~90% of mobile time in apps; ~2x session length)](https://www.mobiloud.com/blog/mobile-apps-vs-mobile-websites)
- [Passion.io — Mobile app retention benchmarks (90-day retention ~25–32% app vs ~15–20% web)](https://passion.io/blog/mobile-app-retention-benchmarks-for-creators-course-coaching-apps)
- [Bryj — Mobile App vs Mobile Web customer lifetime value](https://www.bryj.ai/bryj-blog-mobile-apps-vs-mobile-web-customer-lifetime-value/)
- [Urban Airship — How Push Notifications Impact Mobile App Retention (users who get push retain ~3x better)](https://grow.urbanairship.com/rs/313-QPJ-195/images/WP_App_Retention_Rates_Benchmarks.pdf)
- [Business of Apps — Push Notifications Statistics](https://www.businessofapps.com/marketplace/push-notifications/research/push-notifications-statistics/)
- [MoEngage — Push notification statistics](https://www.moengage.com/learn/push-notification-statistics/)
