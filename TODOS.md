# TODOS

## Before launch

### Upgrade Resend — the free plan's 100/day is shared by every email we send

**Context:** Two independent pipelines draw on the same Resend account:
- **Supabase auth email**, sent over SMTP (`smtp.resend.com`, from `team@joinafterhours.in`).
  Currently silent, because `mailer_autoconfirm` is `true` and no confirmation mail is generated.
- **Edge function email**, sent over the Resend API — the founder's welcome on verification,
  and RSVP notifications to host and attendee.

Both bill to one allowance. The free plan is roughly 3,000/month with a **~100/day**
cap, and the daily one is what binds.

**The problem:** rough per-event cost is 1 email per signup (plus one per resend),
1 per identity verification, and 2 per RSVP. A modest day — 20 signups, 15 verifying,
20 RSVPs — is `20 + 15 + 40 = 75`. Three-quarters of the cap on a day that isn't busy.

It gets tighter the moment email confirmation goes live (see the OTP work on
`feat/email-otp` in both repos): every email signup then spends one before the user
can do anything at all. A launch spike is exactly when this breaks, and it breaks
looking like the app is broken rather than rate-limited.

**Do not "fix" this by raising Supabase's limit.** `rate_limit_email_sent` is 30/hour,
which already permits 720/day — it isn't the constraint. Raising it just lets one busy
hour burn the entire day's Resend budget by mid-morning, and failures on the Resend
side surface worse than a clean Supabase throttle. The 30/hour usefully spreads the
daily budget.

**What to do:**
1. **Upgrade Resend** — roughly $20/month for ~50,000, which removes the ceiling
   entirely. This is the whole fix.
2. **Then, optionally**, raise `rate_limit_email_sent` for launch headroom. Only
   after the Resend cap is gone, and only as high as Resend actually allows.
3. **Check the bounce rate while you're in the dashboard.** With `mailer_autoconfirm`
   on, unverified addresses can receive the founder's welcome, so bounces may already
   be accumulating against the domain's reputation. Finishing the OTP work stops that
   — confirmed addresses only.

**Files that will need touching:** none for the upgrade itself. If raising the hourly
limit, it's `rate_limit_email_sent` in the Supabase auth config
(`PATCH /v1/projects/{ref}/config/auth`), not anything in the repo.

## When the payment gateway is added

### ~~Capacity race during payment delay~~ — DONE 28 Sep 2026

Fixed by the app repo's `supabase/migrations/20260928_event_capacity_enforcement.sql`
(DB trigger on `rsvps` + 15-minute checkout seat hold) and a Pay-tap re-check in
`CheckoutSheet`. Regression test: app repo `supabase/checks/event-capacity-test.sh`.
Original note kept below for context.


**Context:** Events have a host-set `capacity` (null = unlimited). Today RSVP is
instant, so the capacity check at tap-time is accurate. Enforcement currently lives
in the UI only (`EventDetail.jsx` web / `app/event/[id].tsx` iOS): `isFull` blocks
the button and shows "Event full".

**The problem payment introduces:** Once payment is in the flow, there's a delay
between "user taps RSVP" and "RSVP is confirmed/paid." During that window the seat
isn't truly taken yet, so a second user can still see vacant spots, start their own
payment, and only then find the event filled up. Two users can pay for the last seat.

**What to add when payment lands:**
1. **Re-check capacity at confirmation time, server-side** — not just at tap-time.
   The authoritative check must happen when the payment succeeds / RSVP is committed,
   inside a DB transaction. A `BEFORE INSERT` trigger on `rsvps` that counts current
   RSVPs against `events.capacity` and rejects when full closes both this race and the
   direct-API bypass. (This trigger is also the proper server-side enforcement noted
   in the capacity feature — it was deferred as a DB change.)
2. **Graceful fallback when the recheck fails** — if the event filled during the
   payment window: do NOT confirm the RSVP, refund/void the payment (or don't capture
   it), and show a clear "This event filled up while you were checking out — you have
   not been charged" message. Return them to the event with the FULL state.
3. **Consider a short hold/reservation** — optionally reserve the seat for N minutes
   while payment is in flight (pending RSVP row that counts toward capacity and expires
   if unpaid), so the common case never hits the race at all.

**Files that will need touching:** `src/lib/useRsvp.js` + `src/pages/EventDetail.jsx`
(web), `lib/useRsvp.*` + `app/event/[id].tsx` (iOS), and a new Supabase migration for
the `rsvps` capacity trigger.
