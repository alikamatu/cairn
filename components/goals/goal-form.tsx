"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { useStore } from "@/lib/store";
import type { Goal, GoalHorizon } from "@/types/entities";
import { cn } from "@/lib/utils/cn";

const HORIZONS: Array<{ id: GoalHorizon; label: string; sub: string }> = [
  { id: "quarter", label: "Quarter", sub: "90 days" },
  { id: "year",    label: "Year",    sub: "12 months" },
  { id: "life",    label: "Life",    sub: "Long-horizon" },
];

export function GoalFormModal({
  open, onOpenChange, defaultHorizon, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultHorizon?: GoalHorizon;
  onCreated?: (g: Goal) => void;
}) {
  const addGoal = useStore((s) => s.addGoal);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [horizon, setHorizon] = useState<GoalHorizon>(defaultHorizon ?? "quarter");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const t = title.trim();
    if (!t) { setError("Give the goal a title."); return; }
    const g = addGoal({
      title: t,
      why: why.trim() || undefined,
      horizon,
      targetDate: targetDate ? new Date(targetDate).toISOString() : null,
    });
    onCreated?.(g);
    reset();
    onOpenChange(false);
  }
  function reset() {
    setTitle(""); setWhy(""); setHorizon(defaultHorizon ?? "quarter"); setTargetDate(""); setError(null);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}
      title="New goal"
      description="A goal is bigger than a task — it's an outcome your work points toward."
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Title"
          autoFocus
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(null); }}
          error={error ?? undefined}
        />

        <div>
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Horizon</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {HORIZONS.map((h) => {
              const active = horizon === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setHorizon(h.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-start rounded-lg px-3 py-2 text-left transition-colors",
                    active ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg",
                  )}
                >
                  <span className="text-[13px] font-semibold">{h.label}</span>
                  <span className="text-[11px] opacity-80">{h.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Why (north star)</span>
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="What does it mean for you if this lands?"
            rows={3}
            className="block w-full resize-y rounded-lg bg-surface-2 p-3 text-[13.5px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Target date (optional)</span>
          <div className="rounded-lg bg-surface-2 px-1">
            <DatePicker
              value={targetDate ? new Date(targetDate).toISOString() : null}
              onChange={(v) => setTargetDate(v ? v.slice(0, 10) : "")}
              placeholder="No target date"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit">Create goal</Button>
        </div>
      </form>
    </Modal>
  );
}
