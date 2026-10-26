"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flame, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageBody } from "@/components/ui/page";
import { useConfirm } from "@/components/ui/confirm";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { HabitHeatmap } from "@/components/habits/heatmap";
import { bestStreak, completionRate, currentStreak, isDoneToday, ymd } from "@/lib/domain/habits";
import type { HabitCadence } from "@/types/entities";

export default function HabitDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const habit = useStore((s) => s.habits.find((h) => h.id === id));
  const update = useStore((s) => s.updateHabit);
  const remove = useStore((s) => s.deleteHabit);
  const toggle = useStore((s) => s.toggleHabitDay);

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this habit?",
      description: "Streak history and check-ins will be removed. Linked goals stay.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) { remove(habit!.id); router.push("/habits"); }
  }

  if (!habit) return (
    <PageBody className="pt-10">
      <p className="text-fg-muted">Habit not found.</p>
      <Link href="/habits" className="mt-3 inline-flex items-center gap-1 text-[13px] text-accent"><ArrowLeft size={14} /> All habits</Link>
    </PageBody>
  );

  const done = isDoneToday(habit);

  function setCadence(kind: "daily" | "weekly-target" | "custom") {
    let next: HabitCadence;
    if (kind === "daily") next = { kind: "daily" };
    else if (kind === "weekly-target") next = { kind: "weekly-target", perWeek: habit!.cadence.kind === "weekly-target" ? habit!.cadence.perWeek : 3 };
    else next = { kind: "custom", days: habit!.cadence.kind === "custom" ? habit!.cadence.days : [1, 3, 5] };
    update(habit!.id, { cadence: next });
  }

  return (
    <>
      <div className="px-6 pt-6 md:px-10 md:pt-10">
        <Link href="/habits" className="inline-flex items-center gap-1 text-[12.5px] text-fg-subtle hover:text-fg">
          <ArrowLeft size={13} strokeWidth={2} /> All habits
        </Link>
      </div>
      <PageBody>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggle(habit.id, ymd(new Date()))}
                className={`grid h-10 w-10 place-items-center rounded-xl ${done ? "bg-accent text-accent-fg" : "bg-surface-1 text-fg-muted"}`}
              >
                <Flame size={18} strokeWidth={2} />
              </button>
              <input
                value={habit.title}
                onChange={(e) => update(habit.id, { title: e.target.value })}
                className="w-full bg-transparent text-[24px] font-semibold tracking-tight text-fg outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Stat label="Current" value={currentStreak(habit)} suffix="days" />
              <Stat label="Best"    value={bestStreak(habit)} suffix="days" />
              <Stat label="30d rate" value={`${completionRate(habit)}%`} />
            </div>

            <div className="rounded-2xl bg-surface-1 p-5">
              <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">Year overview</h3>
              <HabitHeatmap habit={habit} />
            </div>

            <div className="rounded-2xl bg-surface-1 p-5">
              <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">Recent</h3>
              <ul className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {recentDays(14).map((d) => {
                  const k = ymd(d);
                  const isDone = Boolean(habit.checkins[k]);
                  return (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() => toggle(habit.id, k)}
                        className={`flex h-12 w-full flex-col items-center justify-center rounded-lg text-[10.5px] font-medium ${
                          isDone ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted"
                        }`}
                      >
                        <span>{d.getDate()}</span>
                        <span className="text-[9px] uppercase tracking-wider">{d.toLocaleDateString("en", { weekday: "short" })}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-surface-1 p-4">
              <h4 className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">Cadence</h4>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                {(["daily","weekly-target","custom"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCadence(k)}
                    className={`h-9 rounded-md px-2 text-[12px] font-medium sm:h-8 sm:text-[11.5px] ${habit.cadence.kind === k ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted hover:text-fg"}`}
                  >
                    {k === "weekly-target" ? "Weekly target" : k.charAt(0).toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>

              {habit.cadence.kind === "weekly-target" && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[12px] text-fg-muted">Target</span>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={habit.cadence.perWeek}
                    onChange={(e) => update(habit.id, { cadence: { kind: "weekly-target", perWeek: Math.max(1, Math.min(7, Number(e.target.value) || 1)) } })}
                    className="h-8 w-16 rounded-md bg-surface-2 px-2 text-[12.5px] text-fg outline-none"
                  />
                  <span className="text-[12px] text-fg-muted">× / week</span>
                </div>
              )}

              {habit.cadence.kind === "custom" && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {["S","M","T","W","T","F","S"].map((label, i) => {
                    const active = habit.cadence.kind === "custom" && habit.cadence.days.includes(i as 0|1|2|3|4|5|6);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (habit.cadence.kind !== "custom") return;
                          const set = new Set(habit.cadence.days);
                          const d = i as 0|1|2|3|4|5|6;
                          if (set.has(d)) set.delete(d); else set.add(d);
                          update(habit.id, { cadence: { kind: "custom", days: Array.from(set).sort() as (0|1|2|3|4|5|6)[] } });
                        }}
                        className={`h-8 w-8 rounded-md text-[11.5px] font-semibold ${active ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-surface-1 p-4">
              <h4 className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">Start date</h4>
              <DatePicker
                value={habit.startDate ?? habit.createdAt}
                onChange={(v) => update(habit.id, { startDate: v ? v.slice(0, 10) : null })}
                placeholder="Pick a start date"
                allowClear={false}
              />
              <p className="mt-1 text-[11px] text-fg-subtle">Choose when this habit should begin tracking.</p>
            </div>

            <div className="rounded-2xl bg-surface-1 p-4">
              <h4 className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">Reminder</h4>
              <TimePicker
                value={habit.reminderTime ?? null}
                onChange={(v) => update(habit.id, { reminderTime: v })}
                placeholder="No reminder"
                step={5}
              />
              <p className="mt-1 text-[11px] text-fg-subtle">Web push reminders ship with notifications.</p>
            </div>

            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-surface-1 px-3 text-[13px] font-medium text-[color:var(--danger)] hover:bg-surface-2"
            >
              <Trash2 size={14} strokeWidth={2} /> Delete habit
            </button>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-2xl bg-surface-1 p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[22px] font-semibold tracking-tight text-fg">{value}</span>
        {suffix && <span className="text-[12px] text-fg-subtle">{suffix}</span>}
      </div>
    </div>
  );
}

function recentDays(n: number): Date[] {
  const out: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}
