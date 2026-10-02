# Local setup

How to run Cairn on your machine, from a fresh clone to AI streaming in the assistant.

## Prerequisites

- **Node.js 20+** (Node 22 recommended)
- **npm** (or pnpm/yarn — code uses no lockfile-specific features)
- Accounts on:
  - [Resend](https://resend.com) — transactional email
  - [Paystack](https://paystack.com) — payments (GHS account)
  - [Cloudinary](https://cloudinary.com) — file uploads
  - [Google AI Studio](https://aistudio.google.com/app/apikey) — Gemini API

Test keys work for everything except live billing.

---

## Clone & install

```bash
git clone https://github.com/alikamatu/osama.git cairn
cd cairn
cp .env.example .env.local
npm install
```

---

## Environment variables

Fill in `.env.local`. The minimum for the app to boot is `AUTH_SECRET`. Each section below explains what enables what.

### Required (boot)

```env
AUTH_SECRET=                          # 64-char hex; generate below
APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Generate the auth secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Email (magic-link sign-in)

```env
RESEND_API_KEY=re_…
RESEND_FROM_EMAIL="Cairn <noreply@your-verified-domain.com>"
```

Without these, the sign-in form will fail. The `RESEND_FROM_EMAIL` must be a verified Resend sender domain.

### Billing (Paystack)

```env
PAYSTACK_PUBLIC_KEY=pk_test_…
PAYSTACK_SECRET_KEY=sk_test_…
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_…
```

Test mode works fine for development. Paystack test card: `4084 0840 8408 4081`, any future expiry, CVV `408`, PIN `0000`, OTP `123456`. See [docs/DEPLOY.md](DEPLOY.md) for switching to live and configuring webhooks.

### Uploads (Cloudinary)

```env
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=…
CLOUDINARY_API_SECRET=…
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud
```

### AI (Google Gemini)

```env
GEMINI_API_KEY=…
GEMINI_MODEL=gemini-2.5-flash
```

Without a key, AI surfaces show "AI is not configured" inline instead of failing.

### Web Push (VAPID)

```env
VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=…
NEXT_PUBLIC_VAPID_PUBLIC_KEY=…
VAPID_SUBJECT=mailto:you@example.com
```

Generate fresh keys:

```bash
node -e "const w=require('web-push');const k=w.generateVAPIDKeys();\
console.log('VAPID_PUBLIC_KEY='+k.publicKey);\
console.log('VAPID_PRIVATE_KEY='+k.privateKey);\
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY='+k.publicKey);"
```

> Once a subscription is created against a public key, **never** regenerate. Existing subscriptions will fail to verify and need to be re-subscribed.

### Admin gating

```env
ADMIN_EMAILS=you@example.com,teammate@example.com
```

Comma-separated. Only these emails can reach `/admin/*`. Everyone else gets 404.

### OAuth (optional)

```env
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…

GITHUB_CLIENT_ID=…
GITHUB_CLIENT_SECRET=…

APPLE_CLIENT_ID=…
APPLE_TEAM_ID=…
APPLE_KEY_ID=…
APPLE_PRIVATE_KEY=…                   # the .p8 contents with \n escaped
```

Callback URLs (configure in each provider's console):

```
http://localhost:3000/oauth/google/callback
http://localhost:3000/oauth/github/callback
http://localhost:3000/oauth/apple/callback
```

### Cron secret

```env
CRON_SECRET=…                          # any random string; gates /api/cron/*
```

Generate: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

---

## Run

```bash
npm run dev          # http://localhost:3000
```

Visit `/signin` → enter your email → check inbox (or Resend logs) → click magic link → land in `/onboarding`.

> If the email doesn't arrive, check Resend's dashboard → Logs. Most issues are unverified sender domains.

---

## Test the AI

Once you have a Gemini API key:

```bash
# Set env, then
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Cookie: cairn_session=$YOUR_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}],"context":{"tasks":[],"habits":[],"goals":[]}}'
```

In the UI: open the assistant page (`g a`), send a message — Gemini streams in.

---

## Test push notifications

1. Open `/settings/notifications` in Chrome / Firefox / Safari 16+.
2. Click **Enable** and approve the OS prompt.
3. Click **Send test** — notification appears on your desktop.
4. To exercise the cron, set a habit's reminder time to a minute or two from now, then:

```bash
curl "http://localhost:3000/api/cron/reminders?token=$CRON_SECRET"
```

You'll get `{ "attempted": 1, "succeeded": 1, "total": 1 }` and a real notification.

---

## Test Paystack flow

Sign in → `/settings/billing` → **Upgrade to Pro**. You'll be redirected to Paystack's test checkout. Use the card above. After success, the callback flips your session to Pro and the invoice appears under "Invoices".

---

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Sign-in email never arrives | Sender domain not verified in Resend | Resend dashboard → Domains |
| `AUTH_SECRET is not set` on boot | Missing env | Generate one (see above) |
| Gemini quota exceeded | Quota limit reached | Check quotas at ai.google.dev / console.cloud.google.com |
| Push test fails silently | Browser blocked notifications | Browser settings → Notifications → allow site |
| Onboarding loops back | Cookie not being set | Check that you're on `localhost` not `127.0.0.1` |
| Hydration mismatch on store-backed pages | Wrong import path | Use `useLive*` selectors from `lib/store/selectors` |
| Service worker won't register in dev | Intentional | Add `?sw=1` to the URL or use `next start` |

---

## Scripts

```bash
npm run dev        # Turbopack dev server
npm run build      # Production build
npm run start      # Run prod build locally
npm run lint       # ESLint
npx tsc --noEmit   # Type-check only
```

---

## Useful commands

```bash
# regenerate AUTH_SECRET / CRON_SECRET / VAPID keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "const w=require('web-push');console.log(JSON.stringify(w.generateVAPIDKeys()))"

# inspect the local push-subscription store
cat .data/push-subs.json | jq .

# clean cache (rare)
rm -rf .next && npm run dev
```
