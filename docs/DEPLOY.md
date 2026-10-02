# Deployment

Production deploy guide. Defaults assume **Vercel** + your custom domain (`assistant.alikamatu.com`). Adapt to any host that runs Node 20+.

## Contents

1. [One-time setup](#one-time-setup)
2. [Vercel project](#vercel-project)
3. [Custom domain](#custom-domain)
4. [Environment variables](#environment-variables)
5. [Paystack webhooks](#paystack-webhooks)
6. [Cron jobs](#cron-jobs)
7. [Storage migration](#storage-migration)
8. [Going live with Paystack](#going-live-with-paystack)
9. [Post-deploy checklist](#post-deploy-checklist)

---

## One-time setup

Before the first deploy:

1. **Pick a production domain** — e.g. `assistant.alikamatu.com`.
2. **Verify a sending domain in Resend** that matches (e.g. `alikamatu.com`) — required to send the magic-link email from a non-`onboarding@resend.dev` address in production.
3. **Generate fresh secrets** — never reuse dev secrets in prod.
4. **OAuth redirect URIs** — add the production callback URLs in each provider console:
   ```
   https://assistant.alikamatu.com/oauth/google/callback
   https://assistant.alikamatu.com/oauth/github/callback
   https://assistant.alikamatu.com/oauth/apple/callback
   ```

---

## Vercel project

```bash
# from repo root
vercel link            # connect to your Vercel project (creates .vercel/)
vercel --prod          # first deploy
```

Or via dashboard: **Add New… → Project → Import** from GitHub → select `alikamatu/osama`. Vercel auto-detects Next.js.

Framework preset: **Next.js**. Build command + output: defaults. Node version: 22.x.

---

## Custom domain

In Vercel → Project → **Settings → Domains**:

1. Add `assistant.alikamatu.com`.
2. Add the `CNAME` record at your DNS provider as instructed (point to `cname.vercel-dns.com.`).
3. Wait for the cert to issue (~minutes).

> Once the domain is attached, Vercel automatically sets `VERCEL_URL` and forces HTTPS. Update `NEXT_PUBLIC_SITE_URL` and `APP_URL` to the production URL.

---

## Environment variables

In Vercel → **Settings → Environment Variables**, add every entry from [docs/SETUP.md → Environment variables](SETUP.md#environment-variables) with **production-grade values**:

```
AUTH_SECRET                  # NEW random 32-byte hex
APP_URL                      # https://assistant.alikamatu.com
NEXT_PUBLIC_SITE_URL         # https://assistant.alikamatu.com

RESEND_API_KEY               # production
RESEND_FROM_EMAIL            # "Cairn <noreply@your-verified-domain>"

PAYSTACK_PUBLIC_KEY          # pk_live_…  (see "Going live" below)
PAYSTACK_SECRET_KEY          # sk_live_…
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY

CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

GEMINI_API_KEY               # production key
GEMINI_MODEL                 # e.g. gemini-2.5-flash

VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_SUBJECT                # mailto:operations@your-domain

ADMIN_EMAILS
CRON_SECRET

# OAuth (filled when you set up each provider)
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
APPLE_CLIENT_ID / APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY
```

Set each variable in **Production**, **Preview**, and **Development** environments as needed. For Preview, you may want dev-tier keys.

---

## Paystack webhooks

In Paystack dashboard → **Settings → Webhooks** → add endpoint:

```
https://assistant.alikamatu.com/api/billing/webhook
```

No auth required — the route validates Paystack's `x-paystack-signature` (HMAC-SHA512 of the raw body) against `PAYSTACK_SECRET_KEY`. Test from the Paystack dashboard — you should see `200 OK` in the logs.

Events Cairn currently handles:

- `charge.success` — log only (the post-payment callback already flips the session)
- `subscription.create` / `subscription.disable` — log only
- `invoice.update` / `invoice.payment_failed` — log only

> Persistent auto-renewal requires storing each user's `customer_code` + `authorization` and reacting to webhook events to extend `planRenewsAt`. This needs the DB. Without it, the user manually re-pays at period end.

---

## Cron jobs

### Habit reminders

Set up Vercel Cron (or any external scheduler) calling:

```
https://assistant.alikamatu.com/api/cron/reminders
Authorization: Bearer $CRON_SECRET
```

Recommended cadence: `*/5 * * * *` (every 5 minutes). The endpoint returns:

```json
{ "ok": true, "at": "…", "attempted": N, "succeeded": N, "total": N }
```

In `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "*/5 * * * *" }
  ]
}
```

Vercel automatically passes its built-in `Authorization: Bearer <CRON_SECRET>` header on cron-invoked requests. If you set `CRON_SECRET` in the env and reference it via `vercel.json`, the cron URL is auth-protected.

---

## Storage migration

Cairn's local-first architecture means the production deploy works *immediately* with no database. Each browser keeps its own data in `localStorage`. For multi-device sync, server-side push subscription persistence, and goal-nudge cron jobs, plug in a DB:

1. **MongoDB** — the URI is already in env (`MONGODB_URI`). Drop a thin client into `lib/db/client.ts`.
2. **Replace `lib/push/store.ts`** with the same function shapes, but reading/writing a `pushSubscriptions` collection.
3. **Replace `lib/db/users.ts`** stub with real reads/writes (`updateUserProfile`, etc.).
4. **Mirror Zustand actions to API routes** — the store API stays unchanged; the action bodies become `fetch` calls.

The architecture is designed so this swap touches no UI code.

---

## Going live with Paystack

In the Paystack dashboard:

1. Complete business KYC.
2. **Settings → API Keys & Webhooks** — copy the **live** keys.
3. In Vercel env, swap `PAYSTACK_PUBLIC_KEY` and `PAYSTACK_SECRET_KEY` to the `pk_live_…` / `sk_live_…` values.
4. Re-add the production webhook (live keys use a different signing secret than test).
5. Confirm GHS is enabled as a currency (it is, by default for Ghanaian accounts).
6. Optional: pre-create the **Pro Monthly** and **Pro Yearly** plans in Paystack if you want server-managed recurring charges (the current code uses one-off transactions).

---

## Post-deploy checklist

After `vercel --prod`:

- [ ] Open `https://assistant.alikamatu.com/` → marketing landing loads
- [ ] `https://assistant.alikamatu.com/robots.txt` shows the expected disallow list
- [ ] `https://assistant.alikamatu.com/sitemap.xml` returns the public URLs
- [ ] `https://assistant.alikamatu.com/opengraph-image` renders the 1200×630 OG card
- [ ] **Sign in** with a real email — Resend log shows delivered, magic link works
- [ ] **Subscribe to push** in Settings → Notifications — test notification arrives
- [ ] **Upgrade to Pro** (test mode first) — Paystack callback flips the session, invoice appears
- [ ] **Gemini AI** — chat streams, AI plans generate
- [ ] `/api/cron/reminders` returns 401 without token, 200 with token
- [ ] Google Search Console — submit sitemap, verify ownership
- [ ] **Vercel Logs** — no warnings about middleware (we use `proxy.ts`), no `crypto` errors

---

## Headers, CSP, security

Cairn doesn't ship a custom CSP yet. Add one in `next.config.ts` under `async headers()` when you're ready. Recommended directives:

```ts
{
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' https://api.dicebear.com https://res.cloudinary.com data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://generativelanguage.googleapis.com https://api.paystack.co https://api.cloudinary.com; font-src 'self' data:; frame-src https://checkout.paystack.com"
}
```

(`unsafe-inline` for scripts is needed for the theme-bootstrap `<script>` in root layout; replace with a nonce when you wire one.)

---

## Rollback

Vercel keeps every prod deployment. To roll back: **Deployments → previous build → … → Promote to Production**. No downtime.
