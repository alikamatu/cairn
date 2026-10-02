"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { useStore } from "@/lib/store";
import { buildHabitCtx, buildTaskCtx, streamPost } from "@/lib/ai/client";

export function PlanMyDayModal({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [hints, setHints] = useState("");
  const [text, setText]   = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) {
      abortRef.current?.();
      abortRef.current = null;
      setText("");
      setError(null);
      setStreaming(false);
    }
  }, [open]);

  function run() {
    setError(null);
    setText("");
    setStreaming(true);
    const s = useStore.getState();
    const projById = new Map(s.projects.map((p) => [p.id, p]));
    abortRef.current = streamPost({
      url: "/api/ai/plan",
      body: {
        tasks: s.tasks.slice(0, 60).map((t) => buildTaskCtx(t, t.projectId ? projById.get(t.projectId)?.name : null)),
        habits: s.habits.map(buildHabitCtx),
        hints: hints.trim() || undefined,
      },
      onChunk: (_d, full) => setText(full),
      onDone: () => { setStreaming(false); abortRef.current = null; },
      onError: (msg) => { setError(msg); setStreaming(false); abortRef.current = null; },
    });
  }

  function stop() {
    abortRef.current?.();
    abortRef.current = null;
    setStreaming(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Plan my day"
      description="Gemini reads your open tasks and habits, then proposes a realistic schedule."
      size="lg"
    >
      <div className="space-y-4">
        <textarea
          value={hints}
          onChange={(e) => setHints(e.target.value)}
          placeholder="Optional: anything Gemini should know? Meetings, energy, constraints…"
          rows={2}
          className="block w-full resize-y rounded-lg bg-surface-2 p-3 text-[13.5px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
        />

        <div className="flex items-center justify-between gap-2">
          {streaming ? (
            <Button variant="secondary" onClick={stop}>Stop</Button>
          ) : (
            <Button leadingIcon={<Sparkles size={14} strokeWidth={1.75} />} onClick={run}>
              {text ? "Plan again" : "Plan my day"}
            </Button>
          )}
          {streaming && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted">
              <Loader2 size={12} className="animate-spin" /> Thinking…
            </span>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-[color:var(--danger)]">{error}</p>
        )}

        {(text || streaming) && (
          <div className="max-h-[55vh] overflow-y-auto rounded-2xl bg-surface-2 p-4">
            {text ? <Markdown source={text} /> : (
              <div className="flex items-center gap-2 text-[13px] text-fg-muted">
                <Loader2 size={13} className="animate-spin" /> Reading your tasks and habits…
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
