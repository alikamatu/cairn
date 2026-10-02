# Architecture

This document describes how Cairn is structured: what runs where, how data flows, and where to look to change things.

## Contents

1. [Tenets](#tenets)
2. [Routing & route groups](#routing--route-groups)
3. [Rendering model](#rendering-model)
4. [State & persistence](#state--persistence)
5. [Entity model](#entity-model)
6. [Authentication](#authentication)
7. [Authorization & route gating](#authorization--route-gating)
8. [AI subsystem](#ai-subsystem)
9. [Billing (Paystack)](#billing-paystack)
10. [Web Push & PWA](#web-push--pwa)
11. [Email (Resend)](#email-resend)
12. [Uploads (Cloudinary)](#uploads-cloudinary)
13. [Soft-delete & trash](#soft-delete--trash)
14. [Performance](#performance)
15. [File map](#file-map)

---

## Tenets

1. **Server gates auth; client owns interaction.** Session cookies are verified server-side on every authed render. Component state lives client-side after hydration.
2. **Validate at every boundary.** Every route handler, server action, and webhook parses input with **Zod** before touching state.
3. **No `any`. No raw `as`.** TypeScript strict; `as unknown as` only when narrowing a Zod-parsed value.
4. **Server-only modules import `"server-only"`.** Mail, AI, push, Paystack, Cloudinary helpers physically cannot ship to the client bundle.
5. **Swappable interfaces.** Storage, model provider, and payment gateway are each behind narrow function boundaries. Replacing one requires editing one file.

---

## Routing & route groups

Cairn uses Next.js 16 App Router with **route groups** to compose layouts without leaking auth assumptions:

```
app/
  (marketing)/        Public site. Wraps children with MarketingNav + Footer.
  (auth)/             Pre-onboarding routes. Logo header + ThemeSwitcher only.
  (app)/              Authed app shell. Sidebar + ConfirmProvider + KeyboardProvider.
  (legal)/            Public legal-ish surface: /unsubscribe.
  admin/              Internal pages. Gated by ADMIN_EMAILS env var.
```

A request to `/today` matches `app/(app)/today/page.tsx` and inherits `app/(app)/layout.tsx`. A request to `/pricing` hits `app/(marketing)/pricing/page.tsx` and inherits `app/(marketing)/layout.tsx`. The route group never appears in the URL — it only scopes the layout.

> **Next.js 16 specifics.** The middleware file convention was renamed to `proxy.ts` (see `proxy.ts` at the project root). `searchParams` and `params` in pages are now `Promise<…>` and must be `await`ed. We follow these conventions everywhere.

---

## Rendering model

| Surface | Server | Client | Why |
|---|---|---|---|
| Marketing pages   | Yes | Hydrated for animations only | SEO-friendly, fast |
| `/signin`, `/onboarding` | Yes (shell)        | Form components | Cookies must be checked before render |
| `/verify` (magic link)   | Route handler only | —               | Cookies can only be set in handlers / actions in App Router |
| `(app)/*`         | Layout guards session | Pages mostly client | Pages read from Zustand which is localStorage-backed |
| API routes (`/api/*`)    | Route handlers     | —               | Streaming AI responses use `ReadableStream` |

Authed pages render **client-side after hydration** because the data lives in localStorage. The `(app)/layout.tsx` wraps `{children}` in a [`<Hydrated>`](../components/store/hydrated.tsx) component that shows a skeleton until Zustand has rehydrated. This eliminates the "server has no localStorage" hydration mismatch.

---

## State & persistence

### Store

Single Zustand store at [`lib/store/index.ts`](../lib/store/index.ts) holds all entities. The `persist` middleware writes the JSON snapshot to `localStorage` under key `cairn:store:v1`.

```
useStore.getState() {
  tasks, habits, goals, projects, notes, reviews, conversations,
  hydrated, addTask, updateTask, toggleTask, …
}
```

Selectors hooks for **live** (non-deleted) entities live in [`lib/store/selectors.ts`](../lib/store/selectors.ts):

```ts
const tasks = useLiveTasks();        // tasks where !deletedAt
const goals = useLiveGoals();        // …same for goals, habits, projects, notes
```

Use these in list pages. Detail pages read raw `useStore((s) => s.X.find(…))` so a soft-deleted entity can still be opened (and restored from `/trash`).

### Hydration

The store is initialized with seed data (see [`lib/store/seed.ts`](../lib/store/seed.ts)) for new users. On rehydrate, `sweepExpiredTrash()` purges anything past the 30-day retention window. Components subscribing to slices via `useStore((s) => s.X)` re-render only when that slice changes.

### Why not a database?

A real product needs server-side persistence (multi-device sync, server-side cron access to user data, deletion audit). Cairn's data layer is local-first by design: every action runs synchronously in the client store, the UI never blocks on the network. The same store API will continue to work when MongoDB / Postgres lands — replace the action bodies with `fetch("/api/…")` calls; component contracts don't change.

The session cookie carries small server-relevant fields (theme, timezone, plan, customer code, push subscription marker) so server-rendered surfaces and API routes work without a database.

---

## Entity model

All entities and their relationships live in [`types/entities.ts`](../types/entities.ts).

```
Task        title · status · priority · projectId · labels · due · dueTime
            recurrence · parentId · inbox · order · createdAt
Habit       title · cadence · reminderTime · startDate · checkins
Goal        title · why · horizon · status · milestones · taskIds · habitIds
            targetDate
Project     name · description · color · archived · goalIds
Note        title · body (markdown) · tags · taskIds · goalIds · pinned
Review      kind (daily|weekly|monthly|yearly) · periodStart · content
ChatMessage role · content · createdAt
Conversation title · messages · createdAt · updatedAt
```

Every soft-deletable entity (Task, Habit, Goal, Project, Note) carries `deletedAt?: ISO | null`. Detail pages read by ID; list pages filter `!deletedAt`.

### Relationships

- **Project → Tasks** by `task.projectId`
- **Goal → Tasks/Habits** by `goal.taskIds` / `goal.habitIds`
- **Note → Tasks/Goals** by `note.taskIds` / `note.goalIds` (backlinks)
- **Task → Subtasks** by `task.parentId`

All relationships are nullable / optional — deleting a project unassigns its tasks rather than cascading.

---

## Authentication

### Magic-link flow

1. User submits email at `/signin`.
2. Server action [`sendMagicLink`](../app/(auth)/signin/actions.ts) signs a token with HMAC-SHA256 (`AUTH_SECRET`), sends a Resend email containing `/verify?token=…`.
3. User clicks the link. [`/verify` route handler](../app/(auth)/verify/route.ts) validates the signature, checks expiry (15 min), and sets the session cookie.
4. New user → `/onboarding`. Returning user → `/today`.

The token is **stateless** — no DB lookup. Single-use can be added by writing the nonce to a `usedTokens` collection.

### Session cookie

A signed JWT-shape cookie (`cairn_session`) holds:

```ts
{
  email, name?, avatarId?, avatarUrl?, timezone?, theme?, startOfWeek?,
  onboarded?, plan?, planInterval?, planRenewsAt?, paystackCustomerCode?,
  emailDigest?, iat, exp
}
```

Cookie is HMAC-signed with `AUTH_SECRET`, `HttpOnly`, `SameSite=Lax`, `Secure` in prod, 30-day TTL. Implementation: [`lib/auth/session.ts`](../lib/auth/session.ts).

### OAuth

Generic OAuth handler at [`app/(auth)/oauth/[provider]/callback/route.ts`](../app/(auth)/oauth/%5Bprovider%5D/callback/route.ts). Provider configs (Google, GitHub, Apple) live in `lib/auth/oauth/`. Apple requires a private-key JWT; the env stub is there but you'll need to fill in the credentials.

### Token kinds

| Token | Algo | Secret | TTL | Used for |
|---|---|---|---|---|
| Magic link | HMAC-SHA256 | `AUTH_SECRET` | 15 min | Sign-in |
| Session    | HMAC-SHA256 | `AUTH_SECRET` | 30 days | Authed cookie |
| Unsubscribe | HMAC-SHA256 | `AUTH_SECRET` | — | One-click email unsubscribe |
| Paystack webhook | HMAC-SHA512 | `PAYSTACK_SECRET_KEY` | — | Verify incoming webhooks |
| Cron auth | shared secret | `CRON_SECRET` | — | Auth-protect `/api/cron/*` |

---

## Authorization & route gating

Two layers:

1. **Proxy (Edge)** at [`proxy.ts`](../proxy.ts) — checks for the presence of the session cookie. App routes without a cookie → 307 to `/signin`. Auth routes *with* a cookie → 307 to `/today`. No cookie *contents* are verified here because the Edge runtime lacks `node:crypto`.
2. **Layout / server-component guards** — [`(app)/layout.tsx`](../app/(app)/layout.tsx), [`onboarding/page.tsx`](../app/(auth)/onboarding/page.tsx), [`admin/layout.tsx`](../app/admin/layout.tsx) call `getSession()` which **verifies the HMAC signature**. Invalid cookies are treated as logged-out.

Admin pages additionally check `isAdmin(session.email)` against a comma-separated `ADMIN_EMAILS` env list. Non-admin authenticated users get `notFound()` (404), not 403, so the route's existence isn't revealed.

---

## AI subsystem

### Provider

Google Gemini 2.5 Flash via the official SDK (`@google/genai`). Client singleton at [`lib/ai/gemini.ts`](../lib/ai/gemini.ts).

### Prompts

All system prompts live in [`lib/ai/prompts.ts`](../lib/ai/prompts.ts). They share a common style block (calm, concrete, markdown-only) and add a mode-specific instruction:

| Function | Used in |
|---|---|
| `chatSystem()`      | `/api/ai/chat` — assistant chat |
| `planSystem()`      | `/api/ai/plan` — Today's "Plan my day" |
| `breakdownSystem()` | `/api/ai/breakdown` — Task "Break this down" (returns JSON) |
| `diagnoseSystem()`  | `/api/ai/diagnose` — Goal "What's blocking this?" |
| `noteSystem(mode)`  | `/api/ai/note-assist` — 8 modes (continue, summarize, plan, …) |

### Context fan-out

Clients send a snapshot of relevant data with each call (see [`lib/ai/context.ts`](../lib/ai/context.ts)). The server doesn't have direct access to user data (the source of truth is `localStorage`), so the client packages tasks/habits/goals into a typed `context` payload, validates with Zod on the server, and the prompt builders fold it into the system message.

### Streaming

Helper at [`lib/ai/stream.ts`](../lib/ai/stream.ts) returns a `ReadableStream<Uint8Array>` of text deltas. Endpoints return `new Response(stream, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } })`. Client uses [`streamPost()`](../lib/ai/client.ts) with the `body.getReader()` API for incremental UI.

### Error handling

`classifyAiError()` maps raw Gemini errors to `{ kind, title, body }`:

- `no_credit` → "Gemini quota or credit limit reached."
- `rate_limit` → "Hit a rate limit."
- `auth` → "AI key was rejected."
- `overloaded` → "Gemini is overloaded."

Errors are written into the stream itself (as markdown), so the chat UI renders them like any other reply — no separate error paths.

---

## Billing (Paystack)

GHS-denominated subscriptions. Pro: **GH₵70/mo** or **GH₵640/yr** (saves GH₵200).

```
Client                      /api/billing/checkout      Paystack
  ├─ POST {interval}           ├─ initTransaction        ├─ creates pending tx
  └─ redirect ──────────────── └─ returns auth URL ───── └─ user pays
                                                          ↓
                                /api/billing/callback   /api/billing/webhook
                                  ├─ verifyTransaction   ← server-to-server
                                  └─ flip session.plan  → log event
                                                          (TODO: persist in DB)
```

Files:

- [`lib/billing/paystack.ts`](../lib/billing/paystack.ts) — fetch-based client (`initTransaction`, `verifyTransaction`, `listCustomerByEmail`, `listTransactionsForCustomer`, `verifyWebhookSignature`)
- [`lib/billing/plans.ts`](../lib/billing/plans.ts) — pricing source of truth, GHS currency, period math
- [`lib/billing/subscription.ts`](../lib/billing/subscription.ts) — `readSubscription(session)` returns `{ tier, interval, renewsAt, active, daysUntilRenewal }`
- `app/api/billing/{checkout,callback,webhook,cancel,invoices}/route.ts`

Webhook signature is HMAC-SHA512 of the raw body (header: `x-paystack-signature`). Auto-renewal beyond the first period requires persistent storage of `customer_code` + `authorization` (currently held only in the session cookie — a server-side jobs runner needs DB access).

---

## Web Push & PWA

### Service worker

Hand-rolled at [`public/sw.js`](../public/sw.js). Two responsibilities:

1. **PWA shell cache** — installs cache `cairn-sw-v1-shell` with `/`, `/today`, manifest, icons. Strategy: network-first for navigations (fallback to cached `/today`), cache-first for `_next/static/*`. Never intercepts `/api/*`.
2. **Push delivery** — `push` event renders a notification with title/body/url; `notificationclick` focuses an existing tab or opens a new one.

Registered in production by [`<ServiceWorkerRegister>`](../components/pwa/sw-register.tsx). Dev opts in via `?sw=1` to avoid breaking HMR.

### VAPID

Keys generated once and stored in env (see [docs/SETUP.md](SETUP.md)). The server signs each push with the private key; the browser verifies against the public key it received at subscription time.

### Subscriptions

Stored as JSON at `.data/push-subs.json` via [`lib/push/store.ts`](../lib/push/store.ts) — file-backed for dev, easy to swap for a Mongo collection. Each subscription carries `meta.habitsByTime: Record<HH:MM, string[]>` (habit titles to fire at that time, in the user's timezone).

### Habit reminders

[`/api/cron/reminders`](../app/api/cron/reminders/route.ts) is the fanout endpoint. Designed to be called every 5 minutes by Vercel Cron. For each subscription, it computes `HH:MM` in the user's timezone and sends a push if there's a habit bucket matching. Expired endpoints (404/410) auto-clean.

---

## Email (Resend)

Client singleton at [`lib/mail/resend.ts`](../lib/mail/resend.ts). Templates live in [`lib/mail/templates/`](../lib/mail/templates/). Currently one transactional template (magic link). The from address is `RESEND_FROM_EMAIL` — must be a verified Resend sender domain.

---

## Uploads (Cloudinary)

Cairn never proxies user uploads through its own server. The client requests a signed payload from [`/api/uploads/sign`](../app/api/uploads/sign/route.ts), then POSTs the file directly to Cloudinary's upload endpoint. The signature is SHA-1 of `folder=…&timestamp=…<api_secret>` (Cloudinary's spec). Folders are scoped per email and per `kind` (`avatar` / `note` / `task`).

---

## Soft-delete & trash

Deleting any entity sets `deletedAt = now()`. The Zustand actions:

```ts
deleteTask(id)         // sets deletedAt
restore("task", id)    // clears deletedAt
purge("task", id)      // hard delete
purgeAllTrash()        // empty everything with deletedAt set
sweepExpiredTrash()    // remove items older than TRASH_RETENTION_DAYS (30)
```

`sweepExpiredTrash()` runs on every store rehydrate (page load), so retention is enforced even without a server cron. The `/trash` page lists everything with `deletedAt` and offers per-item restore / purge plus an Empty trash action.

---

## Performance

- **Server bundles** are kept small because all client-touched paths use `"use client"` only where needed; mail/AI/Paystack/Cloudinary modules import `"server-only"` to fail loudly if pulled into a client bundle.
- **Selectors** with `useMemo` keep re-renders narrow.
- **Hydration gate** prevents server/client mismatches on store-backed UI; the visible skeleton is a single render before the real content paints.
- **Service worker** caches the app shell; subsequent navigations to `/today` are instant.
- **No charting library.** Stats and heatmaps are hand-built SVG (~120 LOC).
- **No markdown library.** [`components/ui/markdown.tsx`](../components/ui/markdown.tsx) handles headings, lists, code, links, bold/italic, hr — enough for notes and AI replies.

---

## File map

The whole repo, annotated:

```
README.md                    — entry doc
.env.example                 — env template
proxy.ts                     — edge gate (cookie presence checks)
next.config.ts               — image domains
tailwind / postcss configs
tsconfig.json                — strict TS

app/
  layout.tsx                 — root metadata, JSON-LD, theme bootstrap
  globals.css                — theme CSS variables for 5 themes, prose styles
  sitemap.ts · robots.ts · opengraph-image.tsx  — SEO
  page.tsx                   — root redirect (not used; (marketing) owns /)

  (marketing)/
    layout.tsx               — public site shell (nav + footer)
    page.tsx                 — landing (hero, features, animated demo, pricing tease)
    pricing/page.tsx         — pricing with monthly/yearly toggle + FAQ
    changelog/page.tsx
    docs/{,getting-started,habits,goals,assistant,api}/page.tsx
    privacy/page.tsx · terms/page.tsx

  (auth)/
    layout.tsx               — Logo + ThemeSwitcher only
    signin/page.tsx          — email + OAuth UI
    signin/actions.ts        — sendMagicLink server action
    verify/route.ts          — magic link verify + session set
    verify-request/page.tsx
    onboarding/page.tsx · onboarding/actions.ts
    oauth/[provider]/callback/route.ts
    signout/route.ts

  (app)/
    layout.tsx               — guards session, mounts providers
    today/page.tsx           — Today board entry
    inbox/page.tsx
    tasks/page.tsx · tasks/[id]/page.tsx · tasks/new/page.tsx
    projects/page.tsx · projects/[id]/page.tsx · projects/archived/page.tsx
    habits/page.tsx · habits/[id]/page.tsx · habits/new/page.tsx
    goals/page.tsx · goals/[id]/page.tsx · goals/new/page.tsx
    calendar/page.tsx
    reviews/{layout, page, daily, weekly, monthly, yearly, [id]}/page.tsx
    notes/page.tsx · notes/[id]/page.tsx
    stats/page.tsx
    assistant/page.tsx · assistant/[threadId]/page.tsx
    search/page.tsx
    settings/{layout, page, profile, appearance, preferences, notifications,
      account, billing, security, connections, ai, integrations, data, danger}/page.tsx
    trash/page.tsx

  (legal)/
    layout.tsx · unsubscribe/page.tsx · unsubscribe/actions.ts

  admin/
    layout.tsx · page.tsx · users · flags · deliverability · errors

  api/
    avatars/route.ts
    uploads/sign/route.ts
    billing/{checkout, callback, webhook, cancel, invoices}/route.ts
    push/{subscribe, unsubscribe, test}/route.ts
    ai/{chat, plan, breakdown, diagnose, note-assist}/route.ts
    cron/reminders/route.ts

components/
  ui/                        — Button, Input, Modal, Popover, Select,
                                DatePicker, TimePicker, Markdown, Page,
                                Divider, Confirm
  app/                       — Sidebar, Topbar, ComingSoon
  brand/logo.tsx
  theme/                     — provider + switcher
  auth/                      — auth-form, auth-visual, provider-button
  onboarding/wizard.tsx
  today/                     — today-board, pomodoro, quick-add, plan-my-day,
                                daily-quote
  tasks/                     — task-filters, task-list-view, task-board-view,
                                task-calendar-view
  habits/heatmap.tsx
  goals/                     — goal-form, link-picker
  projects/project-form.tsx
  notes/ai-panel.tsx
  reviews/review-form.tsx
  command/palette.tsx
  keyboard/                  — keyboard-provider, cheatsheet
  marketing/                 — nav, footer, hero, features, pricing-cards,
                                docs-nav, animated-demo
  settings/                  — settings-nav, section, appearance-panel,
                                billing-panel, invoices, push-panel,
                                export-buttons
  store/hydrated.tsx · sync.tsx
  pwa/sw-register.tsx
  focus/focus-mode.tsx
  legal/unsubscribe-form.tsx

hooks/
  use-hotkeys.ts             — useHotkey, useCmdK, useChord

lib/
  utils/cn.ts
  auth/
    session.ts               — sign + verify + cookie helpers
    magic-token.ts           — magic-link HMAC tokens
    unsub-token.ts           — unsubscribe HMAC tokens
    admin.ts                 — ADMIN_EMAILS check
    oauth/ + providers       — Google · GitHub · Apple OAuth
  theme/themes.ts            — 5 theme registry
  store/
    index.ts                 — Zustand store
    seed.ts                  — initial data
    selectors.ts             — live-only entity hooks
  domain/
    habits.ts                — streak math, year grid
    search.ts                — cross-entity fuzzy search
  command/commands.ts        — command-palette registry + fuzzy scorer
  ai/
    anthropic.ts · prompts.ts · stream.ts · client.ts · context.ts
  billing/paystack.ts · plans.ts · subscription.ts
  cloudinary/sign.ts
  push/store.ts · client.ts
  mail/resend.ts · templates/magic-link.ts
  exports/index.ts           — JSON / Markdown / CSV builders
  quotes/daily.ts            — 50 quotes, deterministic-by-date picker
  avatars/store.ts           — avatar listing (file-fallback; DB-swappable)
  db/users.ts                — server-side user profile shim

types/entities.ts            — every entity type

public/
  sw.js                      — service worker
  manifest.webmanifest
  icon.svg · icon-mask.svg

docs/
  ARCHITECTURE.md · DESIGN.md · SETUP.md · DEPLOY.md · API.md · SECURITY.md
```
