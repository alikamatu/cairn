# Cairn

> A calm place to plan, reflect, and progress.

Cairn is a personal productivity app with **daily tasks**, **habit streaks**, **long-horizon goals**, **journal-style notes**, and an **AI assistant** that knows your context. Built on Next.js 16, React 19, and Tailwind v4.

**Production:** [https://assistant.alikamatu.com](https://assistant.alikamatu.com)

---

## Quick start

```bash
git clone https://github.com/alikamatu/osama.git cairn
cd cairn
cp .env.example .env.local        # fill in keys — see docs/SETUP.md
npm install
npm run dev                       # http://localhost:3000
```

You'll need accounts for Resend (email), Paystack (billing, GHS), Cloudinary (uploads), and Google Gemini (AI API). Web-push VAPID keys are generated locally with one command. See [docs/SETUP.md](docs/SETUP.md).

---

## Documentation

| Document | What's inside |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | App shape, data model, state, auth, billing, AI, push, PWA, file map |
| [docs/DESIGN.md](docs/DESIGN.md)             | Design system, themes, tokens, components, motion, accessibility |
| [docs/SETUP.md](docs/SETUP.md)               | Local development, env vars, VAPID generation, troubleshooting |
| [docs/DEPLOY.md](docs/DEPLOY.md)             | Vercel deploy, custom domain, Paystack webhooks, cron, headers |
| [docs/API.md](docs/API.md)                   | Every API endpoint with request/response shapes |
| [docs/SECURITY.md](docs/SECURITY.md)         | Auth model, secrets, signed tokens, threat model |

---

## What you get

### For your users

- **Today board** — drag-reorder tasks, habit check-offs, configurable Pomodoro, daily quote (50 entries, seeded per day), AI "plan my day"
- **Tasks** — list / board / calendar views, filters, full editor with subtasks
- **Habits** — heatmap grid (52 weeks), streak math, custom cadences, reminder times
- **Goals** — grouped by horizon (quarter / year / life), milestone sliders, AI "what's blocking this?"
- **Notes** — markdown editor with live preview, AI assistant (continue, summarize, plan, journal prompts), backlinks to tasks/goals, daily journal
- **Reviews** — daily shutdown / weekly / monthly / yearly with AI-drafted starting points
- **Stats** — animated SVG line chart, by-project breakdown, time-of-day histogram, full habit heatmaps
- **Assistant** — streaming Gemini chat with slash commands and full app context
- **Trash** — soft-delete with 30-day restore, auto-purge on rehydrate
- **Themes** — 5 themes (obsidian, paper, oceanic, sunset, forest)
- **Keyboard** — command palette (⌘K), chord nav (`g t`, `g j`, …), cheatsheet (`?`), quick-add (`N`)
- **PWA** — installable, offline shell for `/today`, web push reminders

### For the developer

- **Production-shape code** — typed entities, validated boundaries, server-only modules, signed cookies
- **Zustand store** with persist middleware — single source of truth across pages
- **Real integrations** — Resend (email magic links), Paystack (subscriptions in GHS), Cloudinary (signed uploads), Google Gemini (streaming chat + tool prompts), VAPID web push
- **No vendor lock-in** — swap MongoDB for Postgres, Gemini for another LLM, Paystack for Stripe; interfaces are clean

---

## Stack

```
Framework      Next.js 16 (App Router, Server Components, Server Actions)
UI             React 19 · Tailwind v4 · Motion (Framer Motion successor) · Lucide
State          Zustand with persist (localStorage)
Auth           Magic-link email · OAuth (Google, GitHub, Apple — scaffold)
Email          Resend
Payments       Paystack (GHS) — Pro GH₵70/mo or GH₵640/yr
AI             Google Gemini 2.5 Flash (streaming + non-streaming)
Uploads        Cloudinary (signed direct upload)
Push           Web Push Protocol with VAPID
PWA            Custom service worker (no Workbox)
Validation     Zod at every server boundary
Dates          date-fns
IDs            nanoid
```

---

## Repo layout (one screen)

```
app/
  (marketing)/   Public site: landing, pricing, changelog, docs, privacy, terms
  (auth)/        Sign-in, magic-link verify, OAuth callbacks, onboarding
  (app)/         Authed app: today, inbox, tasks, projects, habits, goals,
                 calendar, reviews, notes, stats, assistant, search, settings, trash
  (legal)/       /unsubscribe (HMAC-signed)
  admin/         Internal — gated by ADMIN_EMAILS env var
  api/           Route handlers (billing, push, AI, uploads, cron, avatars)
components/      UI primitives + feature components
lib/             auth, billing, ai, push, cloudinary, exports, store, mail, quotes
hooks/           use-hotkeys, etc.
types/           Entity types
public/          Static assets, sw.js, manifest, icons
docs/            Architecture, design, setup, deploy, API, security
```

Full file-by-file map: [docs/ARCHITECTURE.md → File map](docs/ARCHITECTURE.md#file-map).

---

## Scripts

```
npm run dev     Start dev server on :3000 (Turbopack)
npm run build   Production build
npm run start   Run production build
npm run lint    ESLint
```

---

## Contributing

This is a personal project right now. If you fork it for your own use, keep the brand replaceable — every user-facing string is plain text and easy to swap.

---

## License

All rights reserved. Personal-use mirror only.
