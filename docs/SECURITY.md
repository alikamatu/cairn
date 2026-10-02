# Security model

How Cairn protects user data, what's threat-modeled, and what's deliberately out of scope.

## Contents

1. [Trust boundaries](#trust-boundaries)
2. [Secrets](#secrets)
3. [Sessions](#sessions)
4. [Signed tokens](#signed-tokens)
5. [Cookies](#cookies)
6. [Webhooks](#webhooks)
7. [Cron](#cron)
8. [Input validation](#input-validation)
9. [Server-only modules](#server-only-modules)
10. [Admin gating](#admin-gating)
11. [Privacy posture](#privacy-posture)
12. [Out of scope today](#out-of-scope-today)

---

## Trust boundaries

Cairn has four boundaries; everything crossing them is validated:

| Boundary | Who's on each side | Check |
|---|---|---|
| Browser → Server (cookie) | Browser → Next.js | HMAC-signed cookie; rejected if signature fails or `exp` passed |
| Browser → API (body) | Browser → route handler | **Zod** schema parse |
| Paystack → Server (webhook) | Paystack → `/api/billing/webhook` | HMAC-SHA512 signature on raw body |
| External cron → Server | Vercel Cron → `/api/cron/*` | shared `CRON_SECRET` |

No external request modifies state without passing one of these checks.

---

## Secrets

| Variable | Used for | Where it shows up |
|---|---|---|
| `AUTH_SECRET`               | HMAC for magic-link, session, unsubscribe tokens | Server only |
| `PAYSTACK_SECRET_KEY`       | Paystack API auth + webhook signature verify       | Server only |
| `GEMINI_API_KEY`            | Google Gemini API                                   | Server only |
| `RESEND_API_KEY`            | Outbound email                                      | Server only |
| `CLOUDINARY_API_SECRET`     | Signed upload URLs                                  | Server only |
| `VAPID_PRIVATE_KEY`         | Web Push signing                                    | Server only |
| `CRON_SECRET`               | Auth for `/api/cron/*`                              | Server only |
| `APPLE_PRIVATE_KEY`         | Apple Sign-In client JWT                            | Server only |

Public counterparts (`NEXT_PUBLIC_*`) are safe to ship in the client bundle. None of the secrets above are.

> **Rotation.** If `AUTH_SECRET` rotates, every active session and unverified magic link is invalidated immediately. Plan for it.

---

## Sessions

[`lib/auth/session.ts`](../lib/auth/session.ts) — HMAC-SHA256 over a base64-url payload, 30-day TTL.

### Payload

```
{
  email, name?, avatarId?, avatarUrl?, timezone?, theme?, startOfWeek?,
  onboarded?, plan?, planInterval?, planRenewsAt?, paystackCustomerCode?,
  emailDigest?, iat, exp
}
```

### Verification

```ts
verifySessionToken(raw) -> Session | null
```

Steps: split on `.` → recompute HMAC over the body → constant-time compare → JSON.parse → check `exp > now`. Any failure returns `null` and the user is treated as logged-out.

### Why not JWT?

It's effectively a hand-rolled HMAC-signed JWT-shape token. We avoid the JWT library zoo because:

1. We don't need asymmetric crypto.
2. We don't need a typ/alg header (single algorithm, hard-coded).
3. The whole implementation is ~60 lines and auditable in one read.

---

## Signed tokens

Beyond the session cookie, three short-lived tokens use the same HMAC-SHA256 + `AUTH_SECRET`:

| Token | TTL | Single-use? | Carries |
|---|---|---|---|
| Magic link | 15 min | **No** (stateless) | `email`, `mode` |
| Unsubscribe | none | No                | `email`, `scope` |
| AI / API access tokens | — | planned | — |

> Single-use enforcement for magic links requires a `usedTokens` collection. Not in place yet — a stolen token can be replayed until expiry.

---

## Cookies

```
cairn_session
  HttpOnly
  SameSite=Lax
  Secure          (production only)
  Path=/
  Max-Age=2592000 (30 days)
```

`SameSite=Lax` means the cookie won't be sent on cross-site POSTs, which is the protection Cairn relies on for CSRF in server actions (Next 16 also adds its own action-origin check). Sensitive mutations always go through server actions or API routes that check the session cookie.

---

## Webhooks

### Paystack

[`verifyWebhookSignature(rawBody, header)`](../lib/billing/paystack.ts) computes HMAC-SHA512 of the **raw body** (read via `req.text()`, not parsed) and compares against `x-paystack-signature` using `crypto.timingSafeEqual`. A failed signature returns 401.

Important: never parse the body before signing. The exact bytes matter.

### Why no replay protection?

Paystack's webhooks are idempotent against state we maintain (we don't credit accounts twice — the callback already flipped the session). When the DB layer lands, persist the event `id` and dedupe.

---

## Cron

`/api/cron/*` endpoints accept either `?token=` or `Authorization: Bearer …`. Both compared to `CRON_SECRET`. Without a secret set, the route returns 401.

In production, Vercel Cron passes its own auth header automatically.

---

## Input validation

Every route handler and server action validates with **Zod**. Examples:

```ts
const Input = z.object({
  email: z.string().trim().toLowerCase().email(),
  name:  z.string().trim().max(120).optional(),
  mode:  z.enum(["signin", "signup"]),
});
```

Limits are explicit (`.max(120)`) so an attacker can't blow up memory with multi-megabyte fields. The Gemini prompts likewise cap `body.max(40_000)` and `messages.max(40)`.

---

## Server-only modules

Modules that read secrets or talk to vendor APIs import `"server-only"`:

```ts
import "server-only";
```

If any client component accidentally imports them, the build fails. Files that do this:

```
lib/auth/session.ts
lib/auth/magic-token.ts
lib/auth/unsub-token.ts
lib/auth/admin.ts
lib/auth/oauth/*
lib/ai/gemini.ts · lib/ai/prompts.ts · lib/ai/stream.ts
lib/billing/paystack.ts · lib/billing/subscription.ts
lib/cloudinary/sign.ts
lib/mail/resend.ts · lib/mail/templates/*
lib/push/store.ts · lib/push/client.ts
lib/db/users.ts
```

---

## Admin gating

`/admin/*` is **layout-gated** in [`app/admin/layout.tsx`](../app/admin/layout.tsx):

```ts
if (!session) redirect("/signin");
if (!isAdmin(session.email)) notFound();   // 404, not 403
```

The 404 response means the route's existence isn't leaked to unauthenticated or non-admin users. Admin emails come from the comma-separated `ADMIN_EMAILS` env var.

---

## Privacy posture

The privacy policy ([`/privacy`](../app/(marketing)/privacy/page.tsx)) is the authoritative statement. The short version of what's enforced in code:

- **No training on your data.** Cairn forwards your context to Google Gemini *per request*. Paid/Standard API tiers don't train on your content. No third-party analytics see your tasks or notes.
- **No advertising.** No ad SDKs in the bundle.
- **Exports any time.** Settings → Data → JSON / Markdown / CSV. The export is generated entirely on the client from your own store.
- **Account deletion.** Soft-delete works today; full account deletion is on the roadmap (it requires the DB layer).

### Sub-processors

- **Vercel** — hosting + edge
- **Resend** — transactional email
- **Paystack** — payments
- **Cloudinary** — image uploads
- **Google (Gemini)** — AI

Each is contractually a data processor; none receive your full content for training.

---

## Out of scope today

Acknowledged gaps. None of these are accidents — they're scoped for the next slice:

- **MFA / 2FA.** Magic link is the only factor. Combined with email security this is acceptable, but TOTP would harden it for power users.
- **Device-level session listing & revocation.** A "sign out of all sessions" button needs a DB-backed session table.
- **Hard delete + GDPR-style data export package.** Soft-delete + per-entity export is here; an "all my data, including deleted, in one archive" endpoint is not.
- **CSP with nonces.** Recommended directives are in [docs/DEPLOY.md](DEPLOY.md). The theme-bootstrap inline script needs a nonce-aware setup before strict CSP can ship.
- **Rate limits.** The app relies on Vercel's edge rate-limiting; no app-level throttle on `/api/ai/*` or `/api/billing/checkout` yet.
- **Audit log.** Goals are designed to support an append-only audit log; the table doesn't exist yet.
- **Hardware-key OAuth.** Apple Sign-In supports it; we don't currently surface the option.

If any of these matter for your deployment, open them as follow-ups.
