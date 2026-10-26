"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Search, ArrowRight, Sparkles, type LucideIcon } from "lucide-react";
import {
  allCommands, fuzzyScore, NAV_COMMANDS,
  type Command, type CommandGroup,
} from "@/lib/command/commands";
import { useTheme } from "@/components/theme/theme-provider";
import { getRecentRoutes } from "@/components/keyboard/keyboard-provider";
import { useStore } from "@/lib/store";
import type { ThemeId } from "@/lib/theme/themes";
import { cn } from "@/lib/utils/cn";

const GROUP_ORDER: CommandGroup[] = ["Recent", "Ask", "Navigation", "Actions", "Theme"];

export function CommandPalette({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build recent-route commands by matching paths to NAV_COMMANDS.
  const recentCommands: Command[] = useMemo(() => {
    if (!open) return [];
    const paths = getRecentRoutes();
    return paths
      .map((p) => NAV_COMMANDS.find((c) => c.href === p || (c.href && p.startsWith(c.href + "/"))))
      .filter((c): c is Command => Boolean(c))
      .slice(0, 4)
      .map((c) => ({ ...c, group: "Recent" as CommandGroup, id: `recent-${c.id}` }));
  }, [open]);

  const base = useMemo(() => [...recentCommands, ...allCommands()], [recentCommands]);

  const filtered: Command[] = useMemo(() => {
    if (!q.trim()) {
      // Default: show recents + navigation + a few actions.
      return [
        ...recentCommands,
        ...NAV_COMMANDS.slice(0, 6),
        ...allCommands().filter((c) => c.group === "Actions").slice(0, 3),
      ];
    }
    const scored = base
      .map((c) => {
        const labelScore = fuzzyScore(q, c.label);
        const kwScore = c.keywords
          ? Math.min(...c.keywords.map((k) => fuzzyScore(q, k)).filter((s) => s >= 0), 9999)
          : 9999;
        const best = labelScore < 0 ? kwScore : kwScore < 0 ? labelScore : Math.min(labelScore, kwScore);
        return { c, score: best };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 12)
      .map((x) => x.c);

    if (scored.length === 0) {
      return [{
        id: "ask-cairn",
        group: "Ask" as CommandGroup,
        label: `Ask Cairn: "${q}"`,
        icon: Sparkles,
        href: `/assistant?q=${encodeURIComponent(q)}`,
      }];
    }
    return scored;
  }, [q, base, recentCommands]);

  // Reset state on open.
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keep active in range when filtered changes.
  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  // Keep active item in view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function run(cmd: Command) {
    onOpenChange(false);
    if (cmd.href) { router.push(cmd.href); return; }
    switch (cmd.action) {
      case "set-theme": if (cmd.payload) setTheme(cmd.payload as ThemeId); return;
      case "sign-out": window.location.href = "/signout"; return;
      case "open-cheatsheet": window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", shiftKey: true })); return;
      case "new-task":
      case "new-habit":
      case "new-goal":
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
        return;
      case "open-journal": {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const j = useStore.getState().getOrCreateTodaysJournal(tz);
        router.push(`/notes/${j.id}`);
        return;
      }
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter")     { e.preventDefault(); if (filtered[active]) run(filtered[active]); }
    else if (e.key === "Escape")    { e.preventDefault(); onOpenChange(false); }
  }

  // Group filtered into sections in stable order.
  const grouped = useMemo(() => {
    const byGroup = new Map<CommandGroup, Command[]>();
    filtered.forEach((c) => {
      const arr = byGroup.get(c.group) ?? [];
      arr.push(c);
      byGroup.set(c.group, arr);
    });
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({ group: g, items: byGroup.get(g)! }));
  }, [filtered]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 bg-black/45"
          />
          <motion.div
            className="relative z-10 flex w-full max-h-[min(88dvh,720px)] flex-col overflow-hidden rounded-t-2xl bg-surface-1 pb-[env(safe-area-inset-bottom)] sm:max-w-[640px]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden="true">
              <span className="h-1 w-9 rounded-full bg-fg-subtle/35" />
            </div>
            <div className="flex items-center gap-2 px-4 pt-1">
              <Search size={16} strokeWidth={1.75} className="shrink-0 text-fg-subtle" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Type a command, page, or ask Cairn…"
                className="block h-11 w-full min-w-0 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-subtle"
                role="combobox"
                aria-expanded="true"
                aria-controls="cmdk-list"
                aria-activedescendant={filtered[active] ? `cmdk-${filtered[active].id}` : undefined}
              />
              <kbd className="hidden shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle sm:inline">Esc</kbd>
            </div>

            <div className="h-px w-full bg-[color:var(--hairline)]" />

            <div
              id="cmdk-list"
              ref={listRef}
              role="listbox"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
            >
              {grouped.length === 0 && (
                <div className="px-3 py-8 text-center text-[13px] text-fg-subtle">No results.</div>
              )}
              {grouped.map(({ group, items }) => {
                let cursor = filtered.findIndex((c) => c === items[0]);
                return (
                  <div key={group} className="mb-2 last:mb-0">
                    <div className="px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
                      {group}
                    </div>
                    <ul>
                      {items.map((c) => {
                        const idx = cursor++;
                        const isActive = idx === active;
                        return (
                          <li key={c.id}>
                            <button
                              id={`cmdk-${c.id}`}
                              data-idx={idx}
                              role="option"
                              aria-selected={isActive}
                              onMouseMove={() => setActive(idx)}
                              onClick={() => run(c)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
                                isActive ? "bg-surface-2" : "hover:bg-surface-2/60",
                              )}
                            >
                              <CommandIcon Icon={c.icon} />
                              <span className="flex-1 truncate text-[14px] text-fg">{c.label}</span>
                              {c.shortcut && (
                                <span className="flex gap-1">
                                  {c.shortcut.map((k, i) => (
                                    <kbd key={i} className="inline-flex h-5 min-w-[18px] items-center justify-center rounded bg-surface-3 px-1 font-mono text-[10px] text-fg-muted">{k}</kbd>
                                  ))}
                                </span>
                              )}
                              {isActive && (
                                <ArrowRight size={14} strokeWidth={2} className="text-fg-subtle" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 bg-surface-2 px-4 py-2 text-[11px] text-fg-subtle">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1"><FooterKey k="↑" /> <FooterKey k="↓" /> <span>navigate</span></span>
                <span className="inline-flex items-center gap-1"><FooterKey k="↵" /> <span>select</span></span>
              </div>
              <span className="hidden sm:inline">powered by ⌘K</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CommandIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 text-fg-muted">
      <Icon size={14} strokeWidth={1.75} />
    </span>
  );
}

function FooterKey({ k }: { k: string }) {
  return (
    <kbd className="inline-flex h-4 min-w-[16px] items-center justify-center rounded bg-surface-3 px-1 font-mono text-[10px] text-fg-muted">
      {k}
    </kbd>
  );
}
