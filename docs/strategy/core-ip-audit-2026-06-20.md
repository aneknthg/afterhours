# Afterhours — Core IP Strengthening Audit

**Date:** 2026-06-20
**Scope:** Both repos (Afterhours-Website-main, Afterhours-App-main), Supabase schema/migrations, edge functions, MOA draft. No formal PRD exists — the website README and code are the closest thing to a spec, so that's what this was reverse-engineered from.

**Headline finding:** Afterhours is pre-entity-stage (MOA still in draft), single-city (Hyderabad only), ~175 commits, essentially one engineer, soft-launched on Reddit. Almost everything in the current build is commodity CRUD + a single AWS API call. There is exactly **one** genuinely hard-to-copy asset forming, and it isn't being protected or invested in yet. Read Phase 5 and the Final Deliverable first if short on time.

---

## Addendum — same-day follow-up (2026-06-20)

**Correction:** the original audit's #1 "Next 30 Days" action and "single highest ROI investment" — wiring `scoring.js` to live Supabase data — was based on a stale README claim ("Supabase events aren't scored through it yet"). On closer reading of `src/pages/Discover.jsx`, this is already done: it fetches live events, RSVP history (with `decayFactor` time decay), and `event_views` click history from Supabase, and ranks them through `scoreEvent`/`diversify`. The README has been corrected. This means the recommendation graph is closer to "live and accumulating" than the original audit credited — bumping the urgency of Phase 4's *measurement* layer (nothing reads back from this data yet) above re-wiring it.

**Fixed and applied to prod same-day** (via Supabase CLI, `SUPABASE_ACCESS_TOKEN` was available in-session; all changes confirmed with read-only checks before and after):

- **Diagnostic 1 — `record_verification_attempt` RPC:** confirmed it exists and is deployed. Rate-limiting on the Rekognition calls is active; this was not a real gap.
- **Diagnostic 2 — `connections.event_id` type:** confirmed `text` (the same mismatch that broke `rsvps`). Confirmed 0 rows had it set and nothing currently joins through it, so zero blast radius. Fixed via `20260620_fix_connections_event_id_type.sql` — now `uuid` with a proper FK to `events.id`.
- **Verification outcome logging:** added `public.identity_verification_log` (similarity, gender, gender confidence, pass/fail reason per attempt) and wired `verify-identity/index.ts` to write to it on every outcome. This was almost named `verification_attempts` — but that name was already taken in prod by the *existing* rate-limit table backing the RPC above (`user_id`/`window_start`/`count`, same shape as `geocode_rate_limit`). The collision was caught via raw `pg_attribute` introspection before it could cause confusion later; the table was renamed to `identity_verification_log` to avoid it. A harmless redundant index briefly added to the rate-limit table during the collision was identified and dropped.

This closes the concrete blocker on the Phase 4 "verification threshold calibration" and Phase 6 "trade secret" items — outcome data is now accumulating instead of being discarded.

---

## Phase 1: Reverse Engineer The Business

**1. What is the real product?**
Not "an events app." It's a **verified-identity access gate** wrapped around a generic events/social marketplace. The product *promise* is "every woman in this room was checked," not "find cool events." Strip the verification gate and Afterhours is functionally indistinguishable from Meetup/Eventbrite/Insider.in.

**2. What is the hidden value creation engine?**
The RSVP→attendance→connection loop feeding `connections` + `rsvps` + `reviews`. Every event creates a verified social graph edge (who showed up, who connected with whom, who rated whom). That graph is the only thing that gets *more valuable with no additional engineering effort* as usage grows.

**3. What proprietary asset is being accumulated?**
In principle: a graph of verified-women + their hobbies + their real-world co-attendance + trust signals (reports/blocks/ratings). In practice, right now: almost nothing at meaningful scale — single city, early traction, and (per `events.service.js` / README) the recommendation engine isn't even wired to live Supabase data yet. The asset is *architected for* but not yet *accumulating*.

**4. What becomes more valuable as usage grows?**
- The verified-women density in Hyderabad (local liquidity — classic two-sided marketplace dynamic)
- The co-attendance graph (`rsvps` join across users) — this is the only structurally compounding dataset in the schema
- Trust/safety history (`reports`, `blocks`, `trust_level`) — gets more valuable and harder to fake the longer it runs
- Brand position as "the safe one" — reputational, compounds with zero incidents over time

**5. What can competitors copy in 30 days?**
Essentially the entire visible product: event CRUD, RSVP flow, chat with community circles, hobby taxonomy, the regex chat moderation, the scoring formula in `scoring.js` (it's ~80 lines, fully readable to anyone who signs up and opens devtools — it's *client-side* JS, not even server-protected), the geocode caching pattern, even the Rekognition-based verification (CompareFaces + DetectFaces is two AWS API calls any team can wire up in an afternoon — it's literally in the repo with setup instructions). None of this is hard. None of it is patentable as implemented.

**6. What would take competitors 3 years to replicate?**
Not the code — the **density and trust track record**: tens of thousands of identity-verified women in a specific city who trust the platform enough to share real-time location with buddies, attend strangers' events, and keep coming back. That requires sustained zero-major-incident operation, word-of-mouth in a trust-sensitive category, and local market presence. This is a go-to-market moat, not a technical one — which means engineering effort alone won't build it.

**7. What assumptions might be wrong?**
- That AWS Rekognition's binary gender classifier is a durable, legally/socially safe gatekeeping mechanism (it's a known source of bias and will misclassify some real users — every false rejection is a support cost and a PR risk; it also produces a `gender` field on sensitive personal data under DPDP Act 2023, per the MOA's own flag)
- That single-city density alone creates lock-in before a funded competitor can out-spend on incentives in the same city
- That the recommendation/scoring logic matters at all before there's enough event density for it to differentiate (right now there probably aren't enough concurrent events in Hyderabad for sophisticated ranking to be the bottleneck — *trust* is)
- That a single prod-only Supabase project (no staging — per prior incident history with `is_test` isolation and the `rsvps.event_id` type bug) won't corrupt the one asset that's supposed to compound

---

## Phase 2: Identify Existing Moats

| Moat | Current | Future (3yr, if executed) | Ease of Replication | Action |
|---|---|---|---|---|
| Proprietary data | 1/10 | 7/10 | Hard once dense, trivial now | Stop letting `scoring.js` run client-side seed-only — wire it to real RSVP/event data so the data actually starts compounding |
| Network effects | 2/10 | 7/10 | Hard once dense (co-attendance graph), trivial now | Prioritize city density over feature breadth; every new feature that isn't RSVP/connect/chat is a distraction from the one loop that compounds |
| Workflow lock-in | 1/10 | 3/10 | Easy — no calendar/payment/identity lock-in exists yet | ICS export is one-way; nothing pulls users back daily. Build a reason to open the app outside event-browsing (e.g., circle activity, which `useActivityFeed.ts` already half-builds) |
| Distribution advantage | 1/10 | 2/10 | Trivial — no SEO moat, no app store category dominance, no partnerships visible | Not a near-term priority; don't invest here yet |
| Community effects | 3/10 | 7/10 | Medium — community circles are a real retention lever already built | Double down on community-channel engagement metrics; this is underrated relative to event discovery |
| Regulatory advantage | 2/10 | 6/10 | Hard — women-only + biometric verification is a genuine regulatory minefield that a sloppy competitor will avoid | The MOA draft already shows awareness (DPDP Act, payment-aggregator routing). Turn this into an actual moat: get the compliance posture done *properly* before a well-funded competitor enters and gets shut down or sued first, while you're already clean |
| Reputation advantage | 2/10 | 8/10 (highest ceiling) | Very hard once earned, easy to destroy in one incident | This is the real prize. Currently unmanaged — there's no visible incident-response or trust-reporting process beyond the schema. Needs explicit ownership, not just tables |
| Learning loops | 1/10 | 6/10 | Medium | Verification false-positive/negative rate, moderation filter hit-rate, and scoring-signal weights are not being measured or fed back anywhere. No instrumentation = no learning loop yet |
| Domain expertise | 3/10 | 5/10 | Medium | Real but un-encoded — lives in your head, not in a system |
| Integration lock-in | 0/10 | 2/10 | Trivial | Not relevant to this product category — skip |
| Brand authority | 1/10 | 7/10 | Hard once established | "The safe one" positioning is the single best long-term authority play available; currently zero content/PR investment visible |
| Ecosystem effects | 0/10 | 3/10 | N/A | Premature — no host/organizer ecosystem with its own incentives yet |

---

## Phase 3: Discover Missing IP

**Data Moats — what can only this platform collect?**
Real-world co-attendance between identity-verified women, tagged with hobby context and post-event trust ratings. No dating app, no Meetup, no Instagram has *verified-gender + verified-attendance + mutual-rating* in one graph. This triple intersection is the actual unique dataset — but today it's three separate, unscored tables (`rsvps`, `connections`, `reviews`) with no aggregation layer.

**Intelligence Moats**
- Which hobby pairings reliably convert to repeat co-attendance (a "what actually works" graph that no event platform publishes)
- Venue/host reliability scores derived from `avg_host_rating` + cancellation/no-show patterns — currently computed nowhere visible
- City-level demand signal from the waitlist banner (`profile.city` for non-Hyderabad users) — this is genuinely valuable, underused market-entry intelligence sitting in a single text column

**Workflow Moats**
- Buddy/safety-checkin system (`buddy_pings`, `notify-buddies`) is *built* but explicitly dormant per prior product decision. This is actually the highest-workflow-lock-in feature in the codebase (real-time location sharing tied to trusted contacts) and it's turned off. Worth revisiting once the active pipeline includes it — it's the kind of feature a woman opens the app *for*, not despite.

**Agent Moats**
- None exist. No AI agent currently learns from platform-specific interaction history. The "recommendation engine" is a hand-tuned weighted-sum formula, not a learning system. There's a real opportunity to turn the scoring weights (`decayFactor`, the 2/3/1.5/2/3 signal weights in `scoreEvent`) into something that's tuned from real outcome data instead of hardcoded constants — but that requires the engine to actually run on production data first (it currently doesn't).

**Benchmark Moats**
- "Safety incident rate per 10,000 verified RSVPs" is a number literally no competitor can publish, because no competitor verifies gender at signup the way you do. If true and good, this is a category-defining benchmark — but it requires actually measuring and reporting it, which isn't happening today.

**Reputation Moats**
- "The only platform that verifies every member is a real woman before she can RSVP." This is ownable *today* — it's already built — but it's not communicated anywhere visible in the marketing pages (Landing, About, Manifesto, Safety, Press). The IP exists in the backend and isn't being converted into authority.

---

## Phase 4: Design Compounding Assets

| Asset | Why it compounds | Why competitors can't easily replicate | How to acquire it | Value @1yr / @3yr / @5yr |
|---|---|---|---|---|
| Verified co-attendance graph | Every RSVP adds an edge; gets denser, not just bigger | Requires *both* identity verification AND real-world attendance tracking — most platforms have one, not both | Wire `scoring.js` + recommendations RPC to live data now; this is a 1-2 week eng task already mostly built | Low / Medium / High |
| Trust & safety incident ledger | Every clean month is proof; one public incident resets a competitor's trust to zero overnight if you have the track record and they don't | Cannot be bought or rushed — requires elapsed time with zero major failures | Formalize reports/blocks/review process now while volume is low and mistakes are cheap | Low / Medium / Very High |
| City density (Hyderabad) | Liquidity compounds — more verified women → more events → more reasons to stay | Expensive and slow to replicate city-by-city even with $100M (see Phase 5) | Marketing/ops, not engineering — outside this audit's scope but the #1 lever | Medium / High / High (if defended) |
| Verification false-positive/negative dataset | Every verification attempt improves the threshold tuning | Requires your specific user base's face/skin-tone/lighting distribution — generic AWS thresholds won't match a competitor's population either, but yours improves with volume | Start logging `similarity`/`genderConfidence` outcomes against manual review (already computed in `verify-identity/index.ts` — just not stored for analysis) | Low / Medium / Medium-High |
| Hobby-pairing → repeat-engagement correlation | Tells you which event categories actually create lasting connections, not just attendance | Requires the co-attendance graph above as a prerequisite — second-order asset | Build once `connections` + `rsvps` have volume | None / Low / Medium |
| Waitlist demand map (non-Hyderabad cities) | Every signup from outside Hyderabad is a free market-entry signal, growing passively | Trivial to copy the *mechanism*, impossible to copy *your* accumulated list | Already capturing via `profile.city` — just start querying/reporting it | Low / Medium / Medium |

---

## Phase 5: Attack Simulation

**Assume:** $100M funded competitor, top engineering talent, frontier AI access.

**1. How they'd attack:** Skip Hyderabad entirely at first — pick a different metro (avoid a direct density fight you'd win on home turf), clone the entire feature set in under a month (it's all standard patterns: Supabase + RN/Vite + AWS Rekognition is not hard for a strong team), and out-spend on host incentives and paid acquisition to bootstrap density faster than you can organically.

**2. What they'd copy first:** Identity verification flow (literally readable from the repo's own setup comments), the hobby taxonomy, the event/RSVP/chat core loop, the chat moderation regex list. All of this is reproducible in under 2 weeks by a competent team — the architecture is clean enough that a senior engineer could rebuild it from the README alone.

**3. What they'd ignore (correctly, for now):** The scoring algorithm (not even running on real data yet — nothing to copy), the buddy/safety-checkin system (dormant, low priority for them too), the specific hobby-to-circle mapping (cosmetic).

**4. What would remain defensible against them:** Only the things time and trust create — Hyderabad density *if* there's a head start and it's defended aggressively, and the safety track record *if* it's clean and theirs isn't yet (a funded competitor moving fast on gender verification is statistically more likely to have an early incident, not less — speed and trust-building are in tension for them).

**5. What to build immediately to survive:**
- Get the recommendation/connection graph running on real data *now*, while still small enough that data quality bugs (like the `event_id` type mismatch already fixed once) are cheap to catch
- Formalize and start measuring safety/trust metrics before they're needed to defend a PR crisis or pitch a benchmark moat
- Decide and document the city-expansion sequencing *before* a funded competitor forces the issue by picking the second city first

---

## Phase 6: Patent and Trade Secret Opportunities

Honest assessment: **nothing in the current build is independently patentable.** Combining off-the-shelf AWS Rekognition calls with a gender-gated social app is a business-method/obvious-combination pattern, not a novel invention — software patents on "verify face then check gender then gate access" would very likely fail novelty/non-obviousness review, and even if granted, would be expensive to defend and easy to design around (any competitor can use a different verification vendor or build their own classifier).

What's realistic:

| Opportunity | Defensibility | Commercial Value | Ease of Implementation |
|---|---|---|---|
| Trade secret: tuned scoring weights + decay curve, once trained on real outcome data (not the current hardcoded constants) | Medium | Medium | High — already 90% built |
| Trade secret: verification threshold calibration (similarity/confidence cutoffs tuned to the specific user population, not AWS defaults) | Medium | Medium-High | Medium — needs the logging in Phase 4 first |
| Trade secret: safety incident response playbook and trust-level state machine logic | Low-Medium | High (reputational, not technical) | High — mostly process, not code |
| Patent: not recommended at this stage | N/A | N/A | N/A — would burn cash on an application unlikely to survive prosecution or defend against a determined infringer |

**Bottom line:** don't spend legal budget on patents yet. Spend it on getting incorporated properly (per the MOA draft's own notes — payment-aggregator routing, DPDP Act compliance for biometric/gender data) — that's the IP-adjacent legal work that actually matters at this stage, because a compliance failure here is an existential risk, not a missed opportunity.

---

## Phase 7: Core IP Roadmap

**Next 30 Days**
1. Wire the existing recommendation scoring (`scoring.js`) to live Supabase RSVP/event data — stop letting it run on seed data only. This is the single highest-leverage unblock: every other compounding asset depends on the graph actually being populated and used.
2. Start logging verification outcomes (similarity score, gender confidence, pass/fail) for later threshold tuning — these numbers are already computed and currently discarded.
3. Fix the data-integrity debt that undermines the one real asset (the `event_id` type inconsistency pattern already found and fixed on `rsvps` — apply the same fix to the other affected tables before more graph data gets corrupted).

**Next 90 Days**
1. Build a minimal trust/safety dashboard from `reports` + `blocks` + `reviews` — turn the schema into an actual measured asset, not just tables.
2. Convert the verification-gate positioning into the marketing/brand asset it deserves to be — "the safe one" needs to be said explicitly, repeatedly, somewhere a prospective user actually reads it.
3. Decide deliberately whether the buddy/safety-checkin system re-enters the active pipeline — it's the highest-workflow-lock-in built feature and it's sitting dormant.

**Next 12 Months**
1. A real co-attendance + ratings intelligence layer: which hobby pairings and venues drive repeat connection, surfaced back into the scoring engine as a self-improving loop instead of hardcoded weights.
2. A published (even if informal) safety benchmark — incident rate per verified RSVP — that no unverified-network competitor can credibly counter.
3. Deliberate, defended density in Hyderabad before considering city #2, so the network-effect moat has time to actually form before a funded competitor tests it.

**Next 3 Years**
1. A verified-women social graph dense enough, in enough cities, that the cold-start cost for a new entrant exceeds what's rational to spend chasing in any single market.
2. A trust/safety track record long and clean enough to be the actual brand — at that point reputation, not technology, is the moat, and it's the one thing money can't buy quickly.

---

## Final Deliverable

**1. Current defensibility score: 14/100**
Almost everything is reproducible code; the one real differentiator (verified social graph + trust history) hasn't accumulated meaningful volume yet, and isn't even fully wired to production.

**2. Future defensibility score (if the roadmap above is executed): 65/100**
Capped below 80 because the core moat is market density + trust, both of which are slow and never fully unassailable in a multi-sided marketplace — but 65 is a genuinely strong, hard-to-dislodge position for a company at this stage if earned honestly.

**3. Top 10 IP opportunities**
1. Live-wired co-attendance + recommendation graph (currently dormant)
2. Verification threshold tuning as a logged, improvable system
3. Trust/safety incident ledger as a measured, reportable asset
4. Hobby-pairing → repeat-engagement intelligence
5. Safety benchmark publication ("incident rate per verified RSVP")
6. City-demand intelligence from the waitlist signal
7. Brand authority around verified-safety positioning
8. Buddy/safety-checkin workflow lock-in (re-activation)
9. Compliance-as-moat (clean DPDP Act + payment-aggregator posture before competitors)
10. Trade-secret scoring-weight calibration from real outcomes

**4. Top 5 existential risks**
1. **No staging environment, prod-only Supabase** — the asset being compounded (clean graph data) is one schema mistake away from corruption; already hit this once (`event_id` type bug).
2. **Pre-incorporation legal exposure** — the MOA is still a draft; gender-based access control + biometric data processing is a real regulatory and discrimination-claim risk if formalized incorrectly or too late.
3. **AWS Rekognition gender misclassification** — every false rejection is a user-trust hit in a product whose entire brand promise is "we got this right."
4. **A funded competitor entering a different city first and winning the land-grab** before the one real moat (density) has time to form.
5. **Zero instrumentation on trust/safety** — a reputation moat can't be defended if it isn't measured; the first real incident with no track record to point to is reputationally fatal at this stage.

**5. Top 5 moat-building initiatives**
1. Activate the recommendation/graph engine on real data
2. Formalize and measure the trust/safety system
3. Defend and deepen Hyderabad density before expanding
4. Convert verification-gate positioning into explicit brand authority
5. Get compliance (DPDP Act, payment routing) genuinely right before scale forces it

**6. Single highest ROI investment**
Wiring the existing scoring/recommendation logic to live production data. It's mostly already built, it's the prerequisite for every other compounding asset on this list, and it's currently sitting unused.

**7. Single most dangerous blind spot**
Believing the verification *technology* (the AWS Rekognition calls) is the moat. It isn't — it's two API calls anyone can copy this week. The actual moat is everything *around* it that hasn't been built yet: the measured trust history, the density, and the brand authority that technology alone can't fake.

**8. One-sentence future moat**
Afterhours' moat won't be that it verifies women — it'll be the multi-year, dense, measurably-clean co-attendance and trust graph that proves it actually kept them safe, which no faster-moving, better-funded clone can backdate.
