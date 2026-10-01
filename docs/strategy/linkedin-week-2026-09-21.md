# Afterhours LinkedIn — week of Mon 21 Sep 2026

Week 2. Same cadence as `linkedin-week-2026-09-14.md`, deliberately no overlap
with it: five different formulas, five different territories, and human and
technical posts alternating so the page does not read as an engineering blog.

Every claim is sourced from the repo or the live site. Nothing invented.

## Not repeating week 1

| | Week 1 | Week 2 |
|---|---|---|
| Formulas | F11, F17, F15, F13, F20 | F12, F10, F18, F7, F2 |
| Mon | Founder culture, "text me when you're home" | Objection handling, leaving an event early |
| Tue | Thesis: the friend requirement | Thesis: what the ranking refuses to optimise for |
| Wed | Verification, the three checks | Visibility, who can find you |
| Thu | Call to host, no application | Build log, five fixes nobody asked for |
| Fri | Professional spotlight, a room with a reason | R.I.P. the group chat |
| Manifesto quotes used | principles 3 and 5 | principles 1 and 4 |

Rules carried over: no hashtags, no emoji, no links in the body (first comment
instead), no unverified numbers, no claim that Afterhours is a small-rooms
product.

Phrases spent in week 1, do not reuse: "Your next favourite friend is probably
free this Thursday", "the events screen is close to empty", "slow and correct
beats fast and sorry", "permission structure".

## The calendar

| Day | Time (IST) | Category | Formula | Goal | Publishes from |
|---|---|---|---|---|---|
| Mon 21 | 09:30 | Objection Handling (Cat 6) | F12 Permission Slip | comments | page, founder reshares |
| Tue 22 | 08:00 | Brand Thesis (Cat 1) | F10 Contrarian + Receipts | comments | **founder profile**, page reshares |
| Wed 23 | 08:30 | Feature / Trust (Cat 3) | F18 False-Binary Dissolve | comments | page, founder reshares |
| Thu 24 | 08:00 | Founder & Culture (Cat 2) | F7 Odd-Precision Ledger | saves | **founder profile**, page reshares |
| Fri 25 | 09:00 | Brand Thesis / Call to Host | F2 R.I.P. Obituary | reposts | page, founder reshares |

Tuesday and Thursday are the two founder-profile posts of the week, and both are
written in first person for that reason. A post about what you refused to let a
ranking optimise for, or a ledger of five things you fixed that nobody asked for,
lands as a person talking about their own decisions. From a brand account the
same words read as marketing about engineering.

Tuesday is the anchor again, and it is the strongest post across both weeks.

---

## Monday 21 Sep, 09:30 IST
**Category 6, Objection Handling. F12 Permission Slip. Goal: comments.**

One tap on every Afterhours event page reaches a real person on our team.

It is there because of the question we get asked most: what happens if I show up and the evening is not what I thought it would be.

Then leave.

You do not owe the host an explanation. You do not owe the group a reason. You do not owe anyone the polite extra hour that most social plans quietly expect.

We put that in writing because most apps in this category design leaving to feel rude, not by writing a rule, just by never once mentioning that going home early is allowed.

The flag on the event page is for the times it is more than an awkward evening. It reaches a person rather than a queue, and a report is treated as true until we can show otherwise.

Our Safety page is blunt about the limits of that, and deliberately so. Afterhours is where you find the event. Most events are hosted by members, in spaces we do not own, and we have supervision without control over how an evening actually runs. We would rather write that down than imply a guarantee we cannot keep.

What we can do: verify who is in the room, give the host real control over who gets in, and make sure the exit is never the awkward option.

𝐀𝐧 𝐚𝐩𝐩 𝐭𝐡𝐚𝐭 𝐨𝐧𝐥𝐲 𝐰𝐨𝐫𝐤𝐬 𝐰𝐡𝐞𝐧 𝐞𝐯𝐞𝐫𝐲 𝐞𝐯𝐞𝐧𝐢𝐧𝐠 𝐠𝐨𝐞𝐬 𝐩𝐞𝐫𝐟𝐞𝐜𝐭𝐥𝐲 𝐢𝐬 𝐧𝐨𝐭 𝐛𝐮𝐢𝐥𝐭 𝐟𝐨𝐫 𝐫𝐞𝐚𝐥 𝐥𝐢𝐟𝐞.

The last time you left something early, what made it feel allowed?

> Sources: Safety page (verbatim on supervision without control, "Every report
> goes to a real person", the platform is not the host or venue), playbook
> script 6.3.

---

## Tuesday 22 Sep, 08:00 IST — anchor
**Category 1, Brand Thesis. F10 Contrarian + Historical Receipts. Goal: comments.**

I capped popularity at four points in our recommendation code, on purpose.

Every other signal in it is allowed to grow. A direct match between an event tag and a hobby on your profile is worth three points each and has no ceiling. A category you have RSVP'd to before is worth up to three, weighted by how recently. How many people are already going is worth one point per three attendees, and then it stops at four no matter how full the room gets.

That cap is the entire opinion. A ranking where popularity is uncapped becomes a ranking of whatever is already popular, and the woman looking for a Sunday morning bird walk gets shown the biggest party in the city instead.

Four more decisions in the same file, all shipped:

→ Interest outranks crowd. A tag matching something on your profile beats any attendance number in the scoring.

→ Old behaviour decays. What you RSVP'd to in the last two weeks counts at full weight, beyond six months at ten percent. You are allowed to have changed.

→ No more than two events from the same category can run back to back. The feed is forced to break its own pattern.

→ Nothing in it ranks people. Events get scored. Members do not.

From our manifesto: we exist offline, the app is just how you find the room, and everything that matters happens after you close it. A feed built to be scrolled would argue with that. This one is built to be finished.

The tests sit next to the scoring functions, because a ranking nobody can check is only a claim.

If you have shipped a ranking, what did you refuse to let it optimise for?

> Sources: src/utils/scoring.js (all five signals, the popularity cap at 4, the
> decay steps 1.0 / 0.8 / 0.5 / 0.3 / 0.1, diversify maxRun 2), scoring.test.js,
> Manifesto principle 1 (verbatim).
> Publishing scorer internals is a credibility play, not a security exposure:
> nothing here is a control someone can defeat. Your call all the same.

---

## Wednesday 23 Sep, 08:30 IST
**Category 3, Feature / Trust. F18 False-Binary Dissolve. Goal: comments / reposts.**

Two settings, and for a woman hosting something at her own address, both of them are wrong.

Public: the event is findable, and so is she. Anyone can see where she will be on Saturday, address included.

Private: only people she already knows can see it, which produces a room that never grows past the people she already knows.

Most platforms make her pick one of those.

On Afterhours it is three separate decisions the host makes before anything goes live. Who can see the event, from friends only to approval only to open to every verified member. Whether people join instantly or have to ask first. And the location, which for events somewhere personal is only revealed to people she has already approved.

That last one is the piece other platforms skip. An event can be fully public and discoverable by any verified member while the address stays invisible until the host says yes to you specifically. Reach and privacy stop being the same dial.

Visibility was built before the calendar was. In an app about meeting people you have not met yet, deciding who gets to find you is the first safety decision, not a preference buried three screens deep.

If you have hosted something at your own address, what did you have to give up to make it findable?

> Sources: playbook script 6.2, Hosts page host controls. The false binary is the
> post's single contrast; do not add another.

---

## Thursday 24 Sep, 08:00 IST
**Category 2, Founder & Culture as a build log. F7 Odd-Precision Ledger. Goal: saves.**

I shipped five changes on 9 September. Not one of them was requested by a user.

The ledger, nothing rounded:

→ A stranger opening a shared event link saw the city and nothing else. No sign an address existed, no sign that members can see it. Tapping "Reserve my spot" then bounced her to a login screen with no explanation of why. Two lines of copy now say the address exists, and that this is a women-only room where everyone verifies before she can RSVP or message.

→ Signing in from a shared link dropped you on the general events feed instead of the event you had actually clicked. You had to go and find it again.

→ Shared event links had no preview at all. An invitation to an evening in Hyderabad arrived in a WhatsApp thread looking like a bare URL.

→ Android App Links, so an Afterhours link opens the app rather than a browser tab.

→ Our two demo accounts could RSVP inside the app and hit a verification wall on the website, because the two codebases disagreed about what "verified" meant. One definition now, in one file, used by both.

The week before: photos shrunk before they reach storage, the events feed stopped fetching the entire table on every load, and host RSVP requests went from two round trips to one.

Four of those five are a stranger's first thirty seconds with the product, which is the part I had never once walked through as a stranger.

The unglamorous version: what found them was sitting down and using the app as someone who had never seen it before. Not a test suite.

What breaks in your product only for the person arriving from outside?

> Sources: git log 2026-09-09 (0eafe1a, 5c961bc, 2d9c2a1, bda0f03, debec87) and
> 2026-09-03 (53332a0, a3c4f65, e1040c8). Commit bodies carry the detail.
> "Review accounts" is deliberately vague about App Store review; say demo
> accounts if you would rather not signal a submission timeline.

---

## Friday 25 Sep, 09:00 IST
**Brand Thesis into a soft host ask. F2 R.I.P. Category Obituary. Goal: reposts.**

R.I.P. the group chat that was going to become a plan.

Cause of death: unanimous enthusiasm, zero dates proposed.

You know the sequence. Someone drops a pottery studio into the chat. Four people say we should absolutely do this. One says next month for sure. The thread goes quiet, and six weeks later somebody sends a different studio into the same chat and it starts again.

Nobody in that chat is flaky. The chat is missing one person willing to pick a date and put their name on it.

That is the whole job of a host. Not a following, not an events background, not a venue. A date, a thing to do, and being the one who says it out loud first.

Afterhours exists because the second half of that job used to be the hard part. You could pick the date and still not know who would turn up, or whether the people who did were who they said they were. Verification and RSVPs handle that half now.

The first half is still yours. Somebody has to name the day.

From our manifesto: friendship is infrastructure. It does not get built by consensus in a group chat, it gets built by one person putting something on a calendar and other people saying yes to it.

What is the plan sitting in your group chat right now with no date attached to it?

> Sources: Manifesto principle 4 (friendship is infrastructure, loneliness).
> The group chat is an archetype, not a claimed case. It carries no numbers on
> purpose.

---

## First comment, every day

- Mon: the Safety page.
- Tue: the app link.
- Wed: the Hosts page.
- Thu: the app link.
- Fri: the Hosts page.

## Before you publish

- **Tuesday publishes how the recommendation scorer works**, including the
  popularity cap and the decay steps. It is the strongest credibility post
  across both weeks. Nothing in it is a control anyone can defeat by knowing it,
  unlike the verification thresholds that were deliberately left out of week 1.
- **Thursday now says "demo accounts"**, not "review accounts", so nothing in it
  signals an App Store submission timeline.
- **Instagram was reviewed on 9 Sep 2026** (@afterhours.women, 179 followers,
  five posts read through Aside). No collision. All five reels carry the same
  boilerplate caption block ("Afterhours is a women-only platform created to make
  meeting new people...") and differ only in the hook line: "Host or attend
  events" (31 Aug, 88 likes), "Play the sport you've always wanted to" (3 Sep,
  69), "Host or attend listening parties" (27 Aug, 42), "Doomscrolling is
  cancelled" (25 Aug, 63), and the 17 Aug grid post (65). They are top-of-funnel
  category ads. Nothing in either LinkedIn week repeats one.
  - The single adjacency: the reels' "step away from endless scrolling" and
    Tuesday's offline-first argument. Different register, and Tuesday proves it
    with the scorer rather than asserting it, so both can run. Do not let a
    future LinkedIn post restate the slogan.
  - Worth fixing on Instagram separately: five posts sharing one identical
    caption block trains the reader to stop reading captions. Not this doc's
    scope.
- **Still no numbers** about members, events, or cities anywhere in week 2, for
  the same reason as week 1.
- **Distribution is the binding constraint, not these posts.** The page has 9
  followers. See "The real constraint" in `linkedin-week-2026-09-14.md`; it
  applies to both weeks and matters more than any single draft here.
