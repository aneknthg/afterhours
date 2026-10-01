# Afterhours

Women-only social events platform, live in cities across India. Built with React 18, Vite 6, Tailwind CSS 3, Supabase, and React Router 6.

---

## Setup

You need Node.js 18+ and a Supabase project. The free tier works fine.

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in your keys:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Open `supabase-schema.sql`, paste the whole thing into the Supabase SQL Editor, and click Run. Then:

```bash
npm run dev
```

Opens at http://localhost:3000.

To enable Google sign-in: Supabase dashboard, Authentication, Providers, Google. Follow the OAuth setup and set the redirect URL to whatever Supabase shows you.

---

## What's built

**Auth.** Email/password and Google OAuth. The profile row is created at signup, not lazily on first load. This matters because the onboarding page queries the profile immediately after redirect, and a lazy create causes a race. Session fetch is also raced against a 15-second timeout so the app never freezes on a bad connection. After sign-in, the app navigates immediately and lets `ProtectedRoute` handle onboarding detection — no pre-navigate profile query that could hang.

**Onboarding.** Four steps. Intent selection first (new to city, exploring hobbies, meeting people, trying something new, making free time count). Then hobby selection from 40-plus options across ten categories, with a city picker over a fixed list of supported cities. Then identity verification via a Supabase Edge Function that checks face similarity against the profile photo and runs gender inference to enforce the women-only policy. Finally, matched events based on selected hobbies with pre-RSVP capability before the user fully enters the app.

**Discover.** The main feed. A hero carousel at the top shows a featured event with a day-aware label ("Trending · Today", "Spotlight · Saturday"). Below it: a "People like you" section that matches users by shared hobbies and event attendance, personalized horizontal shelf rows, and a browse section that splits into a list and card spotlight on desktop. Category filters (Music, Arts, Food, Books, Sports, Film, Wellness, Tech, Social), mood filters, and full-text search across events and venues. You can RSVP directly from the feed.

**Event detail.** Hero image, or a per-category warm gradient fallback when there's no image. RSVP card with date and venue summary. Attendee list with avatar stack. Star ratings with text reviews. Connection prompt for attendees you share hobbies with. Report and cancel RSVP both have confirmation steps.

**Create Event.** Split layout: a live event card preview on the left updates as you type on the right. Fields: title, category, date/time, venue, description, capacity, price, access mode. Access is either Open (anyone can join) or Curator Approval (the host approves each RSVP request individually). Image upload or Unsplash photo suggestions per category.

**My Events.** Upcoming and past tabs. ICS calendar file download for any event.

**Chat.** Real-time via Supabase Realtime. Two types of circles: event chats (auto-created per event, gated behind RSVP) and community channels (General, Fitness, Creative, Music, Foodie, Bookish, Outdoors, Games, Tech, Wellness, Cinema). Each channel has context-specific ice breaker suggestions. Polls work: create and vote. A client-side keyword filter blocks slurs and solicitation before anything reaches the database. Messages can be individually reported. Online presence is visible in the sidebar. Consecutive messages from the same author are visually grouped. Desktop shows a sidebar and chat pane; mobile is full screen.

**Profile.** Edit display name, bio, and city. Avatar upload with a crop-to-circle modal. Hobby selector. Privacy settings. Verification status with a re-verification flow. Upcoming and past events shown below. Connections listed.

**Public profiles.** View any user's public profile. Connection prompt. Shared event attendance surfaced if it exists.

**Notifications.** A single feed combining RSVP requests on events you host (only if access=approval) and incoming connection requests. Accept or reject inline, grouped by recency. Hosts also receive an email when someone RSVPs; attendees receive an email when they're confirmed (either immediately on open events, or when the host approves them on approval-gated events).

**Connections.** The "People like you" algorithm matches by shared hobbies and shared event attendance. Surfaced on Discover and Event Detail.

**Identity verification.** The `verify-identity` edge function handles the selfie check. It returns verified or rejected with a reason. Skipping it leaves the user in limited access mode: can browse, cannot RSVP, connect, or message. `VerificationGate.jsx` wraps the whole app. Any component can call `requireVerified(() => action)` and the modal flow runs automatically.

**Trust and safety.** Reports go to a `reports` table. Blocks go to `blocks`. Chat has the client-side moderation layer described above. `TrustBadge` appears on verified profiles. `ReviewChecker` monitors attended events and prompts for a rating after they end.

**Cities.** Afterhours is live in every city in `src/lib/city.js`. Members pick one during onboarding, and Discover, Search and People are scoped to it. `/cities` renders from the same list.

**Email notifications.** Transactional email via Resend. Three triggers: welcome email on identity verification, host notification when someone RSVPs (with approval-request wording for gated events), and attendee confirmation when they're approved or instantly join an open event. All sent from `team@joinafterhours.in`. Shared `_shared/email.ts` wrapper used across edge functions.

**Push notifications.** Server-side push via Supabase Edge Functions and Expo push tokens. Seven triggers: new RSVP request, RSVP approved, connection request, connection accepted, event cancelled, event updated, new chat message. Tokens are stored per-user and cleaned up on logout. Real-device delivery requires a paid Apple Developer account (APNS); Expo Go receives notifications in development.

**Marketing pages.** Landing, About, Manifesto, Safety, Child Safety, Press, Hosts, Cities, Terms, Privacy.

---

## What isn't wired up yet

- Push notifications require a paid Apple Developer account for real-device delivery via APNS. The server-side infrastructure is fully built and deployed; the gap is the provisioning profile and certificate.
- Verification outcomes (similarity score, gender confidence) are computed by `verify-identity` but not logged anywhere for later threshold tuning.

---

## Structure

```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── email.ts             Resend transactional email wrapper
│   │   └── founders-email.ts    the founders' welcome email
│   ├── verify-identity/         selfie + gender check on profile photo
│   ├── admin-payouts/           the money view behind /admin (allowlisted)
│   └── send-batch-email/        bulk email for announcements (admin-triggered)
└── migrations/                  all schema changes, applied in filename order

src/
├── App.jsx                      router, providers, lazy-loaded routes
├── lib/
│   ├── AuthContext.jsx           auth state, profile loading
│   ├── SearchContext.jsx         global search state
│   ├── VerificationGate.jsx      app-wide verification trigger
│   ├── supabase.js               supabase client
│   ├── useRsvp.js                RSVP toggle, counts, attendee avatars
│   ├── useEventDetail.js         single event + reviews + attendees
│   ├── useMyEvents.js            upcoming + past RSVPs
│   ├── useProfile.js             load + update profile
│   └── useReviews.js             post-event reviews
├── services/
│   ├── chat.service.js           messages, moderation, reporting
│   ├── connections.service.js    friend requests, suggestions
│   ├── events.service.js         event CRUD, search
│   ├── notifications.service.js  RSVP + connection feed
│   ├── reviews.service.js        star ratings
│   ├── trust.service.js          reports, blocks
│   └── verification.service.js   edge function call
├── pages/
│   ├── Landing.jsx
│   ├── Auth.jsx
│   ├── Onboarding.jsx
│   ├── Discover.jsx
│   ├── EventDetail.jsx
│   ├── MyEvents.jsx
│   ├── CreateEvent.jsx
│   ├── Chat.jsx
│   ├── Profile.jsx
│   ├── PublicProfile.jsx
│   ├── Notifications.jsx
│   ├── Verify.jsx
│   ├── Cities.jsx
│   └── About / Manifesto / Safety / Press / Hosts / Terms / Privacy
├── components/
│   ├── EventCard, CityBanner, HobbySelector, CityPicker
│   ├── MoodFilter, PeopleLikeYou, TrustBadge, ReviewChecker
│   ├── VerificationModal, AvatarCropModal
│   ├── CreatePollModal, PollMessage
│   └── Toast, Header, BottomNav, SearchOverlay, Footer
└── utils/
    └── scoring.js               event scoring (decay factor + diversification)
```

---

## Deploying

**The site deploys itself.** Vercel is connected to this repo, so pushing to
`main` builds and ships it. There is nothing to upload by hand; `npm run build`
is for checking the build locally before you push.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in the Vercel
project settings, not here.

Edge functions are the opposite: nothing deploys them for you, and nothing warns
you when the running copy is behind this repo. Deploy by hand after changing one.

```bash
supabase functions deploy verify-identity
supabase functions deploy send-batch-email
supabase functions deploy admin-payouts
```

Only these three are served from this repo. Payments and the notification
functions live in Afterhours-App-main, and several of them existed here as dead
duplicates until they were removed. Before adding a function back, check which
copy is actually running:

```bash
supabase functions download <slug> --use-api \
  --workdir /tmp/deployed --project-ref ehpgqsghiocvpxnaijnz
diff supabase/functions/<slug>/index.ts /tmp/deployed/supabase/functions/<slug>/index.ts
```

Point `--workdir` outside the repo or it overwrites your working tree.

Set the required secrets:

```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM_EMAIL=team@joinafterhours.in
supabase secrets set WEBHOOK_SECRET=<random-32-char-string>
```

No function in this repo is driven by a database webhook. The notification
functions that are (`notify-chat`, `notify-connection`, `notify-event-update`,
`notify-rsvp`) live in Afterhours-App-main, and their webhooks are configured in
the Supabase dashboard rather than in either repo. `verify-identity` and
`admin-payouts` are called directly by the client; `send-batch-email` is run by
hand.

---

## Stack

React 18, React Router 6, Vite 6, Tailwind CSS 3 (primary: `#ffb1c7`, background: `#171214`), Supabase (auth, postgres, realtime, edge functions), libphonenumber-js, Vercel Analytics.
