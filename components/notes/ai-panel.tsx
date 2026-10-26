"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Sparkles, Send, X, Loader2, ChevronRight, ListTree, Wand2, FileText,
  CalendarPlus, Layers, MessageCircleQuestion, ListChecks, Square, ClipboardCopy, ArrowDownToLine, Replace, Plus,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Markdown } from "@/components/ui/markdown";
import { buildGoalCtx, buildHabitCtx, buildTaskCtx, streamPost } from "@/lib/ai/client";
import { cn } from "@/lib/utils/cn";

export type NoteAssistMode =
  | "continue" | "summarize" | "improve" | "outline"
  | "plan" | "ask" | "expand" | "journal-prompts";

type ApplyAction = "insert" | "append" | "replace";

type Props = {
  noteId: string;
  title: string;
  body: string;
  selection: string;
  cursor: number;
  onApply: (text: string, where: ApplyAction) => void;
};

type IconCmp = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
const PRESETS: Array<{ mode: NoteAssistMode; label: string; icon: IconCmp; hint: string }> = [
  { mode: "plan",            label: "Generate plan",      icon: ListChecks,             hint: "Insert a structured plan" },
  { mode: "continue",        label: "Continue writing",   icon: ChevronRight,           hint: "Pick up where you stopped" },
  { mode: "summarize",       label: "Summarize",          icon: FileText,               hint: "TL;DR of this note" },
  { mode: "outline",         label: "Make an outline",    icon: ListTree,               hint: "Restructure into sections" },
  { mode: "improve",         label: "Improve writing",    icon: Wand2,                  hint: "Clarity, concision, flow" },
  { mode: "expand",          label: "Expand detail",      icon: Layers,                 hint: "Flesh out thin sections" },
  { mode: "journal-prompts", label: "Journal prompts",    icon: CalendarPlus,           hint: "Today's prompts to answer" },
];

export function NoteAIPanel({
  noteId, title, body, selection, cursor, onApply,
}: Props) {
  void noteId; void cursor;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NoteAssistMode>("plan");
  const [instruction, setInstruction] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { abortRef.current?.(); }, []);
  useEffect(() => { previewRef.current?.scrollTo({ top: previewRef.current.scrollHeight }); }, [result]);

  function buildContext() {
    const s = useStore.getState();
    const projById = new Map(s.projects.map((p) => [p.id, p]));
    return {
      tasks:  s.tasks.filter((t) => !t.deletedAt).slice(0, 60)
                .map((t) => buildTaskCtx(t, t.projectId ? projById.get(t.projectId)?.name : null)),
      habits: s.habits.filter((h) => !h.deletedAt).map(buildHabitCtx),
      goals:  s.goals.filter((g) => !g.deletedAt).slice(0, 20).map(buildGoalCtx),
    };
  }

  const run = useCallback((m: NoteAssistMode, instr?: string) => {
    if (streaming) return;
    setError(null);
    setResult("");
    setStreaming(true);
    setMode(m);
    abortRef.current = streamPost({
      url: "/api/ai/note-assist",
      body: {
        mode: m,
        title,
        body,
        selection: selection || undefined,
        instruction: instr ?? instruction ?? undefined,
        context: buildContext(),
      },
      onChunk: (_d, full) => setResult(full),
      onDone:  () => { setStreaming(false); abortRef.current = null; },
      onError: (msg) => { setError(msg); setStreaming(false); abortRef.current = null; },
    });
  }, [body, instruction, selection, streaming, title]);

  function stop() {
    abortRef.current?.();
    setStreaming(false);
    abortRef.current = null;
  }

  function apply(where: ApplyAction) {
    const text = result.trim();
    if (!text) return;
    onApply(text, where);
    setOpen(false);
    setResult("");
    setInstruction("");
  }

  async function copyToClipboard() {
    try { await navigator.clipboard.writeText(result); } catch { /* ignore */ }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent px-3 text-[12px] font-semibold text-accent-fg hover:brightness-110"
      >
        <Sparkles size={12} strokeWidth={2.25} />
        Ask AI
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label="Note AI assistant"
          >
            <button type="button" aria-label="Close" onClick={() => { stop(); setOpen(false); }} className="absolute inset-0 bg-black/45" />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex max-h-[min(92dvh,900px)] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-1 pb-[env(safe-area-inset-bottom)] sm:max-w-[680px]"
            >
              <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden="true">
                <span className="h-1 w-9 rounded-full bg-fg-subtle/35" />
              </div>
              <header className="flex items-center gap-2 px-5 pt-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-accent-fg">
                  <Sparkles size={14} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold tracking-tight text-fg">Note assistant</div>
                  <div className="text-[12px] text-fg-subtle">
                    Pick a preset or describe what you want. Insert it back into the note.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { stop(); setOpen(false); }}
                  aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <X size={15} strokeWidth={2} />
                </button>
              </header>

              <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto px-5 pt-4 sm:grid-cols-[200px_1fr]">
                <nav>
                  <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">
                    {PRESETS.map((p) => {
                      const Icon = p.icon;
                      const active = mode === p.mode;
                      return (
                        <li key={p.mode}>
                          <button
                            type="button"
                            onClick={() => run(p.mode)}
                            disabled={streaming}
                            className={cn(
                              "group relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px]",
                              active ? "bg-accent/15 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                            )}
                          >
                            <Icon size={13} strokeWidth={1.75} className={active ? "text-accent" : ""} />
                            <span className="flex-1 truncate">{p.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <div className="flex min-h-[260px] flex-col">
                  <label className="block text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">Custom instruction</label>
                  <div className="mt-1.5 flex items-end gap-2 rounded-lg bg-surface-2 p-1.5">
                    <textarea
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run("ask"); }
                      }}
                      rows={2}
                      disabled={streaming}
                      placeholder='e.g. "Draft a 1-week plan to launch the landing page" — Enter sends'
                      className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-fg outline-none placeholder:text-fg-subtle disabled:opacity-60"
                    />
                    {streaming ? (
                      <button
                        type="button"
                        onClick={stop}
                        aria-label="Stop"
                        className="grid h-8 w-8 place-items-center rounded-md bg-surface-3 text-fg-muted hover:text-fg"
                      >
                        <Square size={13} strokeWidth={2.5} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => run("ask")}
                        disabled={!instruction.trim()}
                        aria-label="Send"
                        className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-fg disabled:opacity-50"
                      >
                        <Send size={13} strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex-1 rounded-xl bg-surface-2 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
                        {streaming ? "Generating…" : result ? "Suggestion" : "Preview"}
                      </span>
                      {streaming && <Loader2 size={12} className="animate-spin text-fg-subtle" />}
                      {selection && (
                        <span className="ml-auto rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-subtle">
                          on selection
                        </span>
                      )}
                    </div>
                    <div
                      ref={previewRef}
                      className="max-h-[40vh] min-h-[120px] overflow-y-auto pr-1"
                    >
                      {error ? (
                        <p className="text-[12.5px] text-[color:var(--danger)]">{error}</p>
                      ) : result ? (
                        <Markdown source={result} />
                      ) : (
                        <p className="text-[12.5px] text-fg-subtle">
                          {streaming ? "" : "Pick an action on the left or type an instruction."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-2 bg-surface-2 px-5 py-3">
                <div className="flex items-center gap-1.5">
                  <ApplyButton
                    icon={ArrowDownToLine}
                    label={selection ? "Insert at cursor" : "Insert at cursor"}
                    onClick={() => apply("insert")}
                    disabled={!result.trim() || streaming}
                  />
                  <ApplyButton
                    icon={Plus}
                    label="Append to note"
                    onClick={() => apply("append")}
                    disabled={!result.trim() || streaming}
                  />
                  {selection && (
                    <ApplyButton
                      icon={Replace}
                      label="Replace selection"
                      onClick={() => apply("replace")}
                      disabled={!result.trim() || streaming}
                    />
                  )}
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    disabled={!result.trim() || streaming}
                    className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium text-fg-subtle hover:bg-surface-3 hover:text-fg disabled:opacity-50"
                  >
                    <ClipboardCopy size={12} strokeWidth={2} /> Copy
                  </button>
                </div>
                <p className="text-[10.5px] text-fg-subtle">
                  <MessageCircleQuestion size={10} strokeWidth={2} className="mr-1 inline" />
                  Suggestions are drafts — read before inserting.
                </p>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ApplyButton({
  icon: Icon, label, onClick, disabled,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-surface-3 px-2.5 text-[12px] font-semibold text-fg hover:brightness-110 disabled:opacity-50"
    >
      <Icon size={12} strokeWidth={2.25} />
      {label}
    </button>
  );
}
