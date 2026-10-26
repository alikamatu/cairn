"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { useLiveTasks, useLiveHabits } from "@/lib/store/selectors";
import { PageHeader, PageBody } from "@/components/ui/page";
import { ymd } from "@/lib/domain/habits";
import { cn } from "@/lib/utils/cn";

type View = "month" | "week";

export default function CalendarPage() {
  const tasks  = useLiveTasks();
  const habits = useLiveHabits();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  function shift(dir: -1 | 1) {
    setCursor((c) => (view === "month" ? addMonths(c, dir) : addWeeks(c, dir)));
  }
  function jumpToday() { setCursor(view === "month" ? startOfMonth(new Date()) : startOfWeek(new Date(), { weekStartsOn: 1 })); }

  return (
    <>
      <PageHeader
        icon={CalendarDays}
        title="Calendar"
        subtitle="Tasks, habits, and time blocks."
        actions={
          <div className="inline-flex items-center gap-1 rounded-full bg-surface-1 p-1">
            {(["month","week"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "relative inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium capitalize",
                  view === v ? "text-accent-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {view === v && <motion.span layoutId="cal-view" className="absolute inset-0 -z-10 rounded-full bg-accent" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                {v}
              </button>
            ))}
          </div>
        }
      />
      <PageBody>
        <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-1 px-3 py-2">
          <h3 className="text-[15px] font-semibold text-fg">
            {view === "month" ? format(cursor, "MMMM yyyy") : `${format(startOfWeek(cursor, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(cursor, { weekStartsOn: 1 }), "MMM d, yyyy")}`}
          </h3>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Previous"><ChevronLeft size={15} strokeWidth={2} /></button>
            <button type="button" onClick={jumpToday} className="rounded-md bg-surface-2 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg">Today</button>
            <button type="button" onClick={() => shift(1)}  className="grid h-8 w-8 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Next"><ChevronRight size={15} strokeWidth={2} /></button>
          </div>
        </div>

        {view === "month"
          ? <MonthGrid cursor={cursor} tasks={tasks} habits={habits} />
          : <WeekGrid  cursor={cursor} tasks={tasks} habits={habits} />}

        <p className="mt-4 text-center text-[11px] text-fg-subtle">
          External calendar sync (Google · ICS) lands with connections.
        </p>
      </PageBody>
    </>
  );
}

function MonthGrid({ cursor, tasks, habits }: { cursor: Date; tasks: ReturnType<typeof useStore.getState>["tasks"]; habits: ReturnType<typeof useStore.getState>["habits"] }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(cursor),   { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, { tasks: typeof tasks; habitsDone: number }>();
    for (const t of tasks) {
      if (!t.due) continue;
      const key = ymd(t.due);
      const slot = map.get(key) ?? { tasks: [], habitsDone: 0 };
      slot.tasks.push(t);
      map.set(key, slot);
    }
    for (const h of habits) {
      for (const k of Object.keys(h.checkins)) {
        if (!h.checkins[k]) continue;
        const slot = map.get(k) ?? { tasks: [], habitsDone: 0 };
        slot.habitsDone++;
        map.set(k, slot);
      }
    }
    return map;
  }, [tasks, habits]);

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-[color:var(--hairline)]">
      {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
        <div key={d} className="bg-surface-1 px-0.5 py-1.5 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-fg-subtle sm:px-2 sm:text-[10.5px] sm:tracking-[0.14em]">
          <span className="sm:hidden">{d.charAt(0)}</span>
          <span className="hidden sm:inline">{d}</span>
        </div>
      ))}
      {days.map((d) => {
        const inMonth = isSameMonth(d, cursor);
        const today = isSameDay(d, new Date());
        const slot = byDay.get(ymd(d));
        return (
          <div key={d.toISOString()} className={cn("min-h-[72px] bg-bg p-1 sm:min-h-[96px] sm:p-1.5 md:min-h-[112px]", !inMonth && "opacity-50")}>
            <div className="mb-1 flex items-center justify-between">
              <span className={cn("inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-medium", today ? "bg-accent text-accent-fg" : "text-fg-muted")}>{d.getDate()}</span>
              {slot?.habitsDone ? (
                <span className="hidden items-center gap-0.5 font-mono text-[10px] text-fg-subtle sm:inline-flex">
                  <Flame size={9} strokeWidth={2.25} className="text-accent" />
                  {slot.habitsDone}
                </span>
              ) : null}
            </div>
            <ul className="hidden space-y-0.5 sm:block">
              {slot?.tasks.slice(0, 3).map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="block truncate rounded-md bg-surface-1 px-1.5 py-0.5 text-[10.5px] text-fg hover:bg-surface-2">
                    {t.title}
                  </Link>
                </li>
              ))}
              {slot && slot.tasks.length > 3 && <li className="px-1.5 font-mono text-[9px] text-fg-subtle">+{slot.tasks.length - 3} more</li>}
            </ul>
            {slot && slot.tasks.length > 0 && (
              <div className="mt-0.5 flex justify-center gap-0.5 sm:hidden">
                {slot.tasks.slice(0, 3).map((t) => (
                  <span key={t.id} className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekGrid({ cursor, tasks, habits }: { cursor: Date; tasks: ReturnType<typeof useStore.getState>["tasks"]; habits: ReturnType<typeof useStore.getState>["habits"] }) {
  const start = startOfWeek(cursor, { weekStartsOn: 1 });
  const days: Date[] = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  const hours = Array.from({ length: 14 }).map((_, i) => i + 7); // 7am – 8pm

  return (
    <div className="-mx-1 overflow-x-auto rounded-2xl bg-surface-1 p-2 sm:mx-0 sm:p-3">
      <div className="grid min-w-[640px] grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-px bg-[color:var(--hairline)] sm:min-w-[840px] sm:grid-cols-[60px_repeat(7,1fr)]">
        <div className="bg-surface-1" />
        {days.map((d) => {
          const today = isSameDay(d, new Date());
          return (
            <div key={d.toISOString()} className={cn("bg-surface-1 px-2 py-2 text-center", today && "text-accent")}>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-fg-subtle">{format(d, "EEE")}</div>
              <div className="text-[15px] font-semibold">{d.getDate()}</div>
            </div>
          );
        })}

        {hours.map((h) => (
          <ContextRow key={h} hour={h} days={days} tasks={tasks} />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-fg-subtle">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" /> Task</span>
        <span className="inline-flex items-center gap-1"><Flame size={11} className="text-accent" /> Habit check-in</span>
        <span className="ml-auto">{habits.length} habits tracked</span>
      </div>
    </div>
  );
}

function ContextRow({ hour, days, tasks }: { hour: number; days: Date[]; tasks: ReturnType<typeof useStore.getState>["tasks"] }) {
  return (
    <>
      <div className="bg-surface-1 px-2 py-2 text-right font-mono text-[10.5px] text-fg-subtle">
        {String(hour).padStart(2, "0")}:00
      </div>
      {days.map((d) => {
        const matches = tasks.filter((t) => t.due && isSameDay(new Date(t.due), d) && t.dueTime && Number(t.dueTime.slice(0, 2)) === hour);
        return (
          <div key={d.toISOString() + hour} className="min-h-[48px] bg-bg p-1">
            {matches.map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`} className="block truncate rounded-md bg-accent px-1.5 py-1 text-[10.5px] font-medium text-accent-fg hover:brightness-110">
                {t.title}
              </Link>
            ))}
          </div>
        );
      })}
    </>
  );
}
