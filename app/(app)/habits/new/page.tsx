"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flame } from "lucide-react";
import { format } from "date-fns";
import { useStore } from "@/lib/store";
import { PageHeader, PageBody } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import type { HabitCadence } from "@/types/entities";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export default function NewHabit() {
  const router = useRouter();
  const addHabit = useStore((s) => s.addHabit);

  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<HabitCadence>({ kind: "daily" });
  const [perWeek, setPerWeek] = useState(3);
  const [reminderTime, setReminderTime] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const canSave = title.trim().length > 0;

  function setCadenceKind(kind: HabitCadence["kind"]) {
    if (kind === "daily") {
      setCadence({ kind: "daily" });
    } else if (kind === "weekly-target") {
      setCadence({ kind: "weekly-target", perWeek });
    } else {
      setCadence({ kind: "custom", days: [1, 3, 5] });
    }
  }

  function toggleDay(day: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
    if (cadence.kind !== "custom") return;
    const next = new Set(cadence.days);
    if (next.has(day)) next.delete(day); else next.add(day);
    setCadence({ kind: "custom", days: Array.from(next).sort() as Array<0 | 1 | 2 | 3 | 4 | 5 | 6> });
  }

  function handleSubmit() {
    if (!canSave) return;
    addHabit({
      title: title.trim(),
      cadence: cadence.kind === "weekly-target"
        ? { kind: "weekly-target", perWeek }
        : cadence.kind === "custom"
          ? { kind: "custom", days: cadence.days }
          : { kind: "daily" },
      reminderTime: reminderTime || null,
      startDate: startDate || null,
    });
    router.push("/habits");
  }

  return (
    <>
      <div className="px-6 pt-6 md:px-10 md:pt-10">
        <Link href="/habits" className="inline-flex items-center gap-2 text-[13px] text-fg-muted hover:text-fg">
          <ArrowLeft size={14} strokeWidth={2} /> Back to habits
        </Link>
      </div>

      <PageHeader
        icon={Flame}
        title="New habit"
        subtitle="Build a new habit and keep your streak going."
        actions={(
          <Button onClick={handleSubmit} disabled={!canSave}>
            Create habit
          </Button>
        )}
      />

      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            <section className="rounded-2xl bg-surface-1 p-5">
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle" htmlFor="habit-title">
                Title
              </label>
              <input
                id="habit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A habit to build…"
                className="block w-full bg-transparent text-[17px] text-fg outline-none placeholder:text-fg-subtle"
              />
            </section>

            <section className="rounded-2xl bg-surface-1 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-fg">Cadence</h2>
                <span className="text-[11px] text-fg-muted">How often this habit counts</span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(["daily", "weekly-target", "custom"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setCadenceKind(kind)}
                    className={`h-10 rounded-md px-2 text-[13px] font-medium ${cadence.kind === kind ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted hover:bg-surface-3"}`}
                  >
                    {kind === "weekly-target" ? "Weekly target" : kind === "custom" ? "Custom days" : "Daily"}
                  </button>
                ))}
              </div>

              {cadence.kind === "weekly-target" && (
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={perWeek}
                    onChange={(e) => setPerWeek(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                    className="h-10 w-20 rounded-md bg-surface-2 px-3 text-[13px] text-fg outline-none"
                  />
                  <span className="text-[13px] text-fg-muted">times per week</span>
                </div>
              )}

              {cadence.kind === "custom" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {WEEKDAYS.map((label, index) => {
                    const active = cadence.kind === "custom" && cadence.days.includes(index as 0 | 1 | 2 | 3 | 4 | 5 | 6);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleDay(index as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
                        className={`h-10 w-10 rounded-md text-[13px] font-semibold ${active ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl bg-surface-1 p-5">
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">Start date</h3>
              <DatePicker
                value={startDate ? new Date(startDate).toISOString() : null}
                onChange={(v) => setStartDate(v ? v.slice(0, 10) : "")}
                placeholder="Pick a start date"
                allowClear={false}
              />
              <p className="mt-2 text-[11px] text-fg-muted">Choose when this habit should begin tracking.</p>
            </section>

            <section className="rounded-2xl bg-surface-1 p-5">
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">Reminder</h3>
              <TimePicker
                value={reminderTime || null}
                onChange={(v) => setReminderTime(v ?? "")}
                placeholder="No reminder"
                step={5}
              />
              <p className="mt-2 text-[11px] text-fg-muted">Set an optional reminder time for this habit.</p>
            </section>

            <Button onClick={handleSubmit} disabled={!canSave}>
              Create habit
            </Button>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
