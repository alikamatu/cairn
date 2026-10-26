"use client";

import { useRef, useState } from "react";
import { Inbox as InboxIcon, ArrowRight, Folder, Trash2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "@/lib/store";
import { useLiveTasks, useLiveProjects } from "@/lib/store/selectors";
import { useKeyboard } from "@/components/keyboard/keyboard-provider";
import { PageHeader, PageBody, Empty } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

export default function InboxPage() {
  const tasks    = useLiveTasks();
  const projects = useLiveProjects();
  const update   = useStore((s) => s.updateTask);
  const toggle   = useStore((s) => s.toggleTask);
  const remove   = useStore((s) => s.deleteTask);
  const { openQuickAdd } = useKeyboard();

  const inbox = tasks.filter((t) => !t.projectId && !t.inbox && t.status !== "done");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const moveBtnRef = useRef<HTMLButtonElement>(null);

  function toggleSel(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSel() { setSelected(new Set()); }

  function bulkAssignProject(pid: string) {
    selected.forEach((id) => update(id, { projectId: pid }));
    clearSel();
  }
  function bulkSendToToday() {
    selected.forEach((id) => update(id, { inbox: true }));
    clearSel();
  }
  function bulkComplete() {
    selected.forEach((id) => toggle(id));
    clearSel();
  }
  function bulkDelete() {
    selected.forEach((id) => remove(id));
    clearSel();
  }

  return (
    <>
      <PageHeader
        icon={InboxIcon}
        title="Inbox"
        subtitle="Capture quickly — sort later."
        actions={<Button onClick={openQuickAdd} size="md">Capture</Button>}
      />

      <PageBody>
        <div className="mb-3 flex items-center justify-between rounded-xl bg-surface-1 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono text-fg-subtle">
              {inbox.length} item{inbox.length === 1 ? "" : "s"}
            </span>
            <span className="text-fg-subtle">·</span>
            <span className="text-[11px] text-fg-subtle">
              Forward to <span className="font-mono text-fg-muted">in@assistant.alikamatu.com</span> (soon)
            </span>
          </div>
        </div>

        {inbox.length === 0 ? (
          <Empty
            icon={InboxIcon}
            title="Inbox zero"
            body="Press N to capture anything. Sort it later."
            action={<Button onClick={openQuickAdd}>Capture</Button>}
          />
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence>
              {inbox.map((t) => {
                const sel = selected.has(t.id);
                return (
                  <motion.li
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5",
                        sel ? "bg-accent/10" : "bg-surface-1 hover:bg-surface-2",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSel(t.id)}
                        aria-pressed={sel}
                        aria-label={sel ? "Deselect" : "Select"}
                        className={cn(
                          "grid h-5 w-5 place-items-center rounded-md",
                          sel ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-subtle",
                        )}
                      >
                        {sel && <CheckCircle2 size={12} strokeWidth={3} />}
                      </button>
                      <span className="flex-1 truncate text-[14px] text-fg">{t.title}</span>
                      <a
                        href={`/tasks/${t.id}`}
                        className="grid h-7 w-7 place-items-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg"
                        aria-label="Open"
                      >
                        <ArrowRight size={14} strokeWidth={2} />
                      </a>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </PageBody>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto w-auto max-w-[560px] sm:inset-x-0 sm:bottom-6 sm:w-fit sm:max-w-[92vw]"
          >
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-3 p-2 shadow-[0_8px_24px_-12px_rgba(0,0,0,.45)]">
              <span className="px-2 text-[12px] font-mono text-fg-muted">
                {selected.size} selected
              </span>
              <span className="hidden h-5 w-px bg-fg-subtle/20 sm:block" />
              <button
                ref={moveBtnRef}
                type="button"
                onClick={() => setMoveOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={moveOpen}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-surface-2 px-2.5 text-[12px] font-medium text-fg-muted hover:bg-surface-1 hover:text-fg"
              >
                <Folder size={12} strokeWidth={2} />
                <span className="sm:hidden">Move</span>
                <span className="hidden sm:inline">Move to project…</span>
              </button>
              <Popover open={moveOpen} onOpenChange={setMoveOpen} anchor={moveBtnRef.current} align="start">
                <ul role="listbox" className="max-h-[260px] min-w-[200px] overflow-y-auto p-1">
                  {projects.filter((p) => !p.archived).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => { bulkAssignProject(p.id); setMoveOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-surface-3"
                      >
                        <Folder size={12} strokeWidth={1.75} className="text-fg-subtle" />
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </Popover>
              <button onClick={bulkSendToToday}  className="h-8 rounded-md bg-surface-2 px-2.5 text-[12px] font-medium text-fg-muted hover:bg-surface-1 hover:text-fg">
                <span className="sm:hidden">Today</span>
                <span className="hidden sm:inline">Send to today</span>
              </button>
              <button onClick={bulkComplete}     className="h-8 rounded-md bg-surface-2 px-2.5 text-[12px] font-medium text-fg-muted hover:bg-surface-1 hover:text-fg">Complete</button>
              <button onClick={bulkDelete}       className="h-8 rounded-md bg-surface-2 px-2.5 text-[12px] font-medium text-[color:var(--danger)] hover:bg-surface-1" aria-label="Delete"><Trash2 size={13} strokeWidth={2} /></button>
              <button onClick={clearSel}         className="h-8 rounded-md px-2.5 text-[12px] text-fg-subtle hover:text-fg">Clear</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
