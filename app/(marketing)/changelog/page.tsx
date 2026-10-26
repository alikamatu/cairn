type Entry = { version: string; date: string; tag: "shipped" | "next"; items: string[] };

const ENTRIES: Entry[] = [
  {
    version: "0.1.0",
    date: "May 19, 2026",
    tag: "shipped",
    items: [
      "SSO sign-in (Google, GitHub, Apple)",
      "Onboarding wizard: name, avatar, theme, timezone, start of week",
      "Today: tasks (drag-reorder), habits, pomodoro, quick-add",
      "5 themes (Obsidian, Paper, Oceanic, Sunset, Forest)",
      "Command palette ⌘K, cheatsheet (?), chord nav (g-prefix)",
      "Settings hub with 9 sections",
      "Paystack subscriptions (GH₵)",
      "Marketing site, pricing, docs, changelog",
    ],
  },
  {
    version: "0.2.0",
    date: "Up next",
    tag: "next",
    items: [
      "MongoDB / persistence layer",
      "Tasks page with list / board / calendar views",
      "Habits heat-map grid + leaderboard",
      "Goals with milestones and AI 'break it down'",
      "AI Assistant chat with streamed replies",
      "Email digest (daily) + web push reminders",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <h1 className="text-[40px] font-semibold tracking-[-0.02em] text-fg">Changelog</h1>
        <p className="mt-3 text-[15px] text-fg-muted">
          A running log of what we&apos;ve shipped and what&apos;s coming next.
        </p>
      </header>

      <ol className="space-y-10">
        {ENTRIES.map((e) => (
          <li key={e.version} className="relative rounded-2xl bg-surface-1 p-6">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[12px] text-fg-muted">
                v{e.version}
              </span>
              <span className="text-[12px] uppercase tracking-[0.16em] text-fg-subtle">{e.date}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                e.tag === "shipped" ? "bg-accent/15 text-accent" : "bg-surface-2 text-fg-muted"
              }`}>
                {e.tag}
              </span>
            </div>
            <ul className="mt-4 space-y-2">
              {e.items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-[14px] leading-relaxed text-fg">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-subtle" />
                  {it}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
