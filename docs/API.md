# API reference

Every server route, with shape. Cairn's API is consumed by its own client today; there's no public API surface yet (that's the `/v1/*` roadmap).

> All responses are JSON unless noted. Streaming endpoints return `text/plain` with `Transfer-Encoding: chunked`. All routes are at the same origin as the app.

## Conventions

- **Auth**: most routes require the `cairn_session` cookie. Failures return `401 { "error": "unauthorized" }`.
- **Validation**: request bodies are parsed with **Zod**. Bad shapes return `400 { "error": "<message>" }`.
- **Idempotency**: not supported; clients should not retry mutating requests on timeout without checking state.

## Index

- [Auth](#auth)
- [Onboarding](#onboarding)
- [Avatars](#avatars)
- [Uploads](#uploads)
- [Billing](#billing)
- [Push notifications](#push-notifications)
- [AI](#ai)
- [Cron](#cron)
- [Unsubscribe](#unsubscribe)

---

## Auth

### `POST` magic-link send (server action)

Not a public HTTP endpoint — called via React Server Action from the sign-in form.

```ts
sendMagicLink({ email, name?, mode: "signin" | "signup" })
  -> { ok: true; email } | { ok: false; error }
```

Sends an HMAC-signed magic-link email (15-min TTL).

### `GET /verify?token=…`

Route handler. Validates the token, sets the session cookie, redirects:

- `success` → `/onboarding` (new user) or `/today` (returning)
- `expired` → `/signin?error=expired`
- malformed/invalid sig → `/signin?error=invalid`

### `GET /oauth/[provider]/callback?code=…&state=…`

OAuth callback for `google` | `github` | `apple`. Exchanges code, fetches the user email, upserts a session.

### `GET /signout`

Clears the session cookie, 302 → `/signin`.

---

## Onboarding

### Server action: `completeOnboarding(input)`

```ts
input: {
  name: string,
  avatarId: string,
  theme: "obsidian" | "paper" | "oceanic" | "sunset" | "forest",
  timezone: string,
  startOfWeek: "sun" | "mon",
}
-> redirect("/today")  // never returns to the caller
```

---

## Avatars

### `GET /api/avatars`

Returns the available avatar gallery. File-backed today (Dicebear URLs); designed to be swapped for a DB.

```json
{ "avatars": [ { "id": "av-01", "url": "https://…", "label": "Atlas" }, … ] }
```

---

## Uploads

### `POST /api/uploads/sign`

Returns a Cloudinary signed-upload payload for client-side direct upload. **Auth required.**

```jsonc
// Request
{ "kind": "avatar" | "note" | "task" }     // default: "note"

// Response
{
  "cloudName": "your_cloud",
  "apiKey": "324737226711696",
  "timestamp": 1779241864,
  "signature": "156ccb95…",
  "folder": "cairn/notes/email_at_example_com",
  "uploadUrl": "https://api.cloudinary.com/v1_1/your_cloud/auto/upload"
}
```

Client then POSTs `{ file, ...payload }` directly to `uploadUrl`. Cairn never proxies the bytes.

---

## Billing

All endpoints require auth.

### `POST /api/billing/checkout`

Initialize a Paystack transaction.

```jsonc
// Request
{ "interval": "monthly" | "yearly" }

// Response
{
  "authorizationUrl": "https://checkout.paystack.com/…",
  "reference": "cairn_alikamatu14g_mpdenzva_wwwbu5"
}
```

Amounts are server-determined: monthly **GH₵70**, yearly **GH₵640**. Client redirects to `authorizationUrl`.

### `GET /api/billing/callback?reference=…`

Paystack's redirect-back target. Verifies the transaction, sets `session.plan = "pro"` + `planRenewsAt`, redirects to `/settings/billing?status=success` (or appropriate failure code).

### `POST /api/billing/webhook`

Paystack → Cairn. Validates `x-paystack-signature` (HMAC-SHA512 of raw body). Handles `charge.success`, `subscription.*`, `invoice.*`. Returns `{ "received": true }`.

### `POST /api/billing/cancel`

Marks the subscription as non-renewing. Pro stays active until `planRenewsAt`.

```jsonc
// Response
{ "ok": true, "message": "Auto-renewal disabled. Pro remains active until period end." }
```

### `GET /api/billing/invoices`

Fetches the user's last 30 transactions from Paystack (lookup by `paystackCustomerCode` if known, else by email).

```jsonc
{
  "invoices": [
    {
      "id": 1234567,
      "reference": "cairn_…",
      "amountMinor": 7000,
      "currency": "GHS",
      "status": "success",
      "paidAt": "2026-05-19T18:32:00.000Z",
      "createdAt": "2026-05-19T18:31:55.000Z",
      "channel": "card",
      "plan": "pro",
      "interval": "monthly"
    }
  ],
  "hasCustomer": true
}
```

---

## Push notifications

All endpoints require auth.

### `POST /api/push/subscribe`

Register a new subscription (or update meta on an existing one).

```jsonc
// Request
{
  "subscription": {                     // from pushManager.subscribe(...).toJSON()
    "endpoint": "https://fcm.google…",
    "keys": { "p256dh": "…", "auth": "…" }
  },
  "meta": {
    "timezone": "Africa/Lagos",
    "habitsByTime": { "06:30": ["Morning run"], "21:00": ["Read"] }
  }
}

// Response
{ "ok": true, "id": "…" }
```

### `POST /api/push/unsubscribe`

```jsonc
// Request
{ "endpoint": "https://fcm.google…" }

// Response
{ "ok": true }
```

### `POST /api/push/test`

Sends a "Push notifications are working" notification to every device subscribed under your email.

```jsonc
// Response
{ "sent": 1, "total": 1 }
```

---

## AI

All endpoints require auth. All accept a `context` envelope so the model sees real data.

### Context shape

```ts
{
  user?: { name?, timezone?, startOfWeek? },
  tasks?: Array<{ id, title, status, priority, projectName?, due?, dueTime? }>,
  habits?: Array<{ id, title, streak, doneToday }>,
  goals?: Array<{ id, title, why?, horizon, status, milestones: [{title, progress, done}] }>,
}
```

The client builds this via helpers in [`lib/ai/client.ts`](../lib/ai/client.ts).

### `POST /api/ai/chat`  — *streaming*

Free-form assistant chat. Streams text deltas.

```jsonc
// Request
{
  "messages": [
    { "role": "user", "content": "Plan today" },
    { "role": "assistant", "content": "Here's…" },
    { "role": "user", "content": "Drop the meeting block" }
  ],
  "context": { "tasks": [...], "habits": [...], "goals": [...] }
}

// Response
text/plain; charset=utf-8
<markdown deltas streaming>
```

### `POST /api/ai/plan`  — *streaming*

Day plan.

```jsonc
// Request
{
  "tasks": [...],
  "habits": [...],
  "hints": "I have a 2pm meeting and a hard stop at 6pm"
}
```

Returns markdown with a `## Schedule` and `## Why` section.

### `POST /api/ai/breakdown` — *one-shot JSON*

Break a task into 3–6 subtasks.

```jsonc
// Request
{ "title": "Plan Q3 roadmap", "notes": "optional notes block" }

// Response (success)
{ "subtasks": ["Define top three outcomes", "Draft Gantt", "Get peer review", "Decide and ship"] }

// Response (failure)
{ "error": "Gemini quota or credit limit reached", "detail": "…", "kind": "no_credit" }
```

### `POST /api/ai/diagnose`  — *streaming*

Goal blocker diagnosis.

```jsonc
// Request
{ "goal": { … as GoalCtx }, "tasks": [...], "habits": [...] }
```

Returns markdown with `## Likely blockers` and `## This week's smallest step` sections.

### `POST /api/ai/note-assist`  — *streaming*

Inline note assistant. Eight modes.

```jsonc
// Request
{
  "mode": "continue" | "summarize" | "improve" | "outline" | "plan" | "ask" | "expand" | "journal-prompts",
  "title": "Optional title",
  "body": "the current note body — full markdown",
  "selection": "optional selected slice the model should focus on",
  "instruction": "optional free-text instruction (required for mode='ask')",
  "context": { … }
}
```

Returns raw markdown — meant to be inserted at cursor / appended / replace selection.

### AI error envelope (one-shot endpoints)

```jsonc
{
  "error": "<title>",
  "detail": "<friendly body>",
  "kind": "no_credit" | "no_key" | "rate_limit" | "auth" | "overloaded" | "unknown"
}
```

For **streaming** endpoints, errors are written into the stream as markdown. No separate error path.

---

## Cron

### `GET /api/cron/reminders`

Fan-out for habit reminders. Auth via `?token=$CRON_SECRET` or `Authorization: Bearer $CRON_SECRET`.

For each push subscription, computes the local HH:MM in the user's timezone. If any `habitsByTime[HH:MM]` matches, sends a push.

```jsonc
// Response
{ "ok": true, "at": "2026-05-20T12:01:13.335Z", "attempted": 3, "succeeded": 3, "total": 7 }
```

Recommended cron: every 5 minutes.

---

## Unsubscribe

### `POST` confirm (server action)

```ts
confirmUnsubscribe({ token })
  -> { ok: true } | { ok: false; error }
```

Validates the HMAC-signed token. If the user is signed in (and emails match), mirrors the choice into the session cookie (`emailDigest = "off"`). The canonical record lives in the users collection (when the DB layer is wired).

Public, no session required — the signed token is the auth.
