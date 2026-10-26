"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

type Row = { keys: string[]; label: string };
type Group = { title: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    title: "Navigation",
    rows: [
      { keys: ["g", "t"], label: "Go to Today" },
      { keys: ["g", "i"], label: "Go to Inbox" },
      { keys: ["g", "k"], label: "Go to Tasks" },
      { keys: ["g", "p"], label: "Go to Projects" },
      { keys: ["g", "h"], label: "Go to Habits" },
      { keys: ["g", "g"], label: "Go to Goals" },
      { keys: ["g", "c"], label: "Go to Calendar" },
      { keys: ["g", "r"], label: "Go to Reviews" },
      { keys: ["g", "n"], label: "Go to Notes" },
      { keys: ["g", "j"], label: "Today's journal" },
      { keys: ["g", "s"], label: "Go to Stats" },
      { keys: ["g", "a"], label: "Go to Assistant" },
      { keys: ["g", ","], label: "Open Settings" },
    ],
  },
  {
    title: "Actions",
    rows: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["N"],       label: "New (task / habit / note)" },
      { keys: ["?"],       label: "Show this cheatsheet" },
      { keys: ["Esc"],     label: "Close modal / palette" },
    ],
  },
  {
    title: "Lists",
    rows: [
      { keys: ["J"], label: "Move down" },
      { keys: ["K"], label: "Move up" },
      { keys: ["X"], label: "Toggle complete" },
      { keys: ["↵"], label: "Open focused item" },
    ],
  },
];

export function Cheatsheet({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            className="relative z-10 flex w-full max-h-[min(92dvh,820px)] flex-col overflow-hidden rounded-t-2xl bg-surface-1 pb-[env(safe-area-inset-bottom)] sm:max-w-[720px]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden="true">
              <span className="h-1 w-9 rounded-full bg-fg-subtle/35" />
            </div>
            <header className="flex shrink-0 items-center justify-between gap-3 px-5 pt-2 sm:px-6">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-fg">Keyboard shortcuts</h2>
                <p className="text-[12px] text-fg-subtle">Hit <kbd className="rounded bg-surface-2 px-1 font-mono">?</kbd> anywhere to open this.</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                aria-label="Close cheatsheet"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </header>

            <div className="grid grid-cols-1 gap-x-8 gap-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:grid-cols-3 sm:px-6 sm:py-6">
              {GROUPS.map((g) => (
                <div key={g.title}>
                  <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
                    {g.title}
                  </h3>
                  <ul className="space-y-2">
                    {g.rows.map((r) => (
                      <li key={r.label} className="flex items-center justify-between gap-3">
                        <span className="text-[13px] text-fg-muted">{r.label}</span>
                        <span className="flex items-center gap-1">
                          {r.keys.map((k, i) => (
                            <kbd
                              key={i}
                              className="inline-flex h-6 min-w-[22px] items-center justify-center rounded-md bg-surface-2 px-1.5 font-mono text-[11px] font-medium text-fg"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
