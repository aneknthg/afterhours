# afterhours — Claude Code Guide

## Project Overview

React 18 + Vite SPA for a social events discovery app. Key stack:
- **React 18** with lazy-loaded pages and code splitting
- **Vite 6** dev server (`npm run dev` → `http://localhost:3000`)
- **Supabase** for auth, database, and storage
- **React Router v6** for client-side routing
- **Tailwind CSS v3** for styling

## Routes

| Path | Page | Auth required |
|------|------|---------------|
| `/landing` | Landing | No |
| `/auth` | Sign in / Sign up / Reset password | No |
| `/onboarding` | Onboarding | Yes (no verification needed) |
| `/verify` | Identity verification | Yes (no verification needed) |
| `/discover` | Event feed | Yes (no verification needed) |
| `/event/:id` | Event detail | No |
| `/my-events` | User's RSVPs | Yes + verified |
| `/create` | Create event | Yes + verified |
| `/chat` | Messaging | Yes + verified |
| `/notifications` | Notifications | Yes + verified |
| `/admin` | Payout admin (allowlisted emails only) | Yes + verified |
| `/profile` | Own profile | Yes (no verification needed) |
| `/profile/:id` | Public profile | No |
| `/liveness` | Liveness handoff for the mobile app | Token in URL fragment |
| `/about` `/manifesto` `/press` `/safety` `/child-safety` `/hosts` `/cities` `/terms` `/privacy` | Static pages | No |

Unauthenticated visits to `/discover` redirect to `/auth`; unverified accounts hitting a
"Yes + verified" route redirect to `/verify`.

## Dev Commands

```bash
npm run dev      # start Vite dev server on :3000
npm run build    # production build
npm run preview  # preview production build on :4173
```

---

## GStack

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted
workflows, including headless browser QA. Install it with:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Use the `/browse` skill from gstack for all web browsing. Never use the
`mcp__claude-in-chrome__*` tools.

Available gstack skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`,
`/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`,
`/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`,
`/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`,
`/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`,
`/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`,
`/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`,
`/learn`.

### Headless Browser QA

GStack is the `/gstack` skill. Use it to visually QA pages, verify interactions, compare before/after, and catch regressions — all without a real browser open.

**When to use GStack:**
- After any UI change, to visually confirm it looks correct
- To test user flows end-to-end (auth, RSVP, create event)
- To check responsive layouts (mobile vs desktop)
- To verify loading states and skeleton screens work
- To catch broken navigation or missing redirects

### Starting a GStack session

Always start the dev server first, then invoke the skill:

```
/gstack
```

The base URL for all checks is `http://localhost:3000`.

---

### Key pages to test and what to verify

#### Landing page (`/landing`)
- Hero text and CTA button visible
- "Sign In" link navigates to `/auth`
- No layout overflow on mobile (375px wide)

#### Auth page (`/auth`)
- Email/password fields present
- Toggle between sign-in and sign-up modes
- Form validation errors display correctly
- Successful login redirects to `/discover`

#### Discover page (`/discover`)
- Event cards render (or skeleton cards while loading)
- Mood filter chips are clickable
- Search overlay opens when tapping the search icon
- Bottom nav visible on mobile

#### Event Detail (`/event/:id`)
- Event title, date, location, and attendee list shown
- RSVP button present; clicking it triggers auth gate for unauthenticated users
- Recommendation carousel scrolls horizontally

#### Create Event (`/create`)
- Form fields: title, date, location, description, tags
- Place picker opens and accepts input
- Submit redirects to the new event's detail page

#### Chat (`/chat`)
- Conversation list loads
- Clicking a thread opens the message view
- Message input field present and focusable

#### Profile (`/profile`)
- Avatar, display name, bio visible
- Hobby tags shown
- My connections section renders

---

### Responsive testing

Test every page at these widths:
- **375px** — iPhone SE (primary mobile target)
- **390px** — iPhone 14
- **768px** — tablet
- **1280px** — desktop

```
/gstack navigate http://localhost:3000/landing, set viewport 375x812, screenshot
```

---

### Common GStack flows for this app

#### Unauthenticated user flow
1. Navigate to `http://localhost:3000/`
2. Confirm redirect to `/landing`
3. Click "Join Now" → should land on `/auth`
4. Verify sign-up form renders

#### Protected route redirect
1. Navigate directly to `http://localhost:3000/create`
2. Confirm redirect to `/auth` (ProtectedRoute guard)

#### Event card interaction
1. Navigate to `/discover`
2. Wait for event cards to appear (skeleton → cards)
3. Click a card → confirm navigation to `/event/:id`
4. Verify back navigation returns to `/discover`

#### Mobile bottom nav
1. Set viewport to 375x812
2. Navigate to `/discover`
3. Confirm BottomNav is visible and all 5 tabs are tappable

---

### Annotated screenshot tips

When filing a bug or reviewing a PR, use annotated screenshots:
- Highlight the broken element
- Compare side-by-side with expected state
- Include the viewport size in the filename/note

---

### What GStack cannot test here

- **Supabase auth** — real email/password login requires live credentials; use a test account
- **Real-time chat** — WebSocket events won't fire without another active session
- **File uploads** (avatar, event images) — require multipart form interaction; verify UI only

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
