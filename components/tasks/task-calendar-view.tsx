"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Task } from "@/types/entities";
import { ymd } from "@/lib/domain/habits";
import { cn } from "@/lib/utils/cn";

const PRIORITY_DOT = { low: "bg-fg-subtle", med: "bg-warning", high: "bg-danger" } as const;

export function TaskCalendarView({ tasks }: { tasks: Task[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(month),   { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due) continue;
      const key = ymd(t.due);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  return (
    <div className="rounded-2xl bg-surface-1 p-3">
      <header className="flex items-center justify-between px-2 pb-3">
        <h3 className="text-[15px] font-semibold text-fg">{format(month, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} className="grid h-8 w-8 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Previous month">
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <button type="button" onClick={() => setMonth(startOfMonth(new Date()))} className="rounded-md bg-surface-2 px-2 py-1.5 text-[11px] font-medium text-fg-muted hover:text-fg">Today</button>
          <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} className="grid h-8 w-8 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Next month">
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-[color:var(--hairline)]">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
          <div key={d} className="bg-surface-1 px-0.5 py-1.5 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-fg-subtle sm:px-2 sm:text-[10.5px] sm:tracking-[0.14em]">
            <span className="sm:hidden">{d.charAt(0)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
        {days.map((d) => {
          const inMonth = isSameMonth(d, month);
          const today = isSameDay(d, new Date());
          const items = byDay.get(ymd(d)) ?? [];
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "min-h-[64px] bg-bg p-1 sm:min-h-[96px] sm:p-1.5",
                !inMonth && "opacity-50",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cn(
                  "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-medium",
                  today ? "bg-accent text-accent-fg" : "text-fg-muted",
                )}>{d.getDate()}</span>
                {items.length > 2 && <span className="hidden font-mono text-[10px] text-fg-subtle sm:inline">+{items.length - 2}</span>}
              </div>
              <ul className="hidden space-y-1 sm:block">
                {items.slice(0, 2).map((t) => (
                  <li key={t.id}>
                    <Link href={`/tasks/${t.id}`} className="flex items-center gap-1.5 rounded-md bg-surface-1 px-1.5 py-0.5 text-[11px]">
                      <span className={cn("h-1 w-1 shrink-0 rounded-full", PRIORITY_DOT[t.priority])} />
                      <span className={cn("truncate", t.status === "done" ? "text-fg-subtle line-through" : "text-fg")}>{t.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {items.length > 0 && (
                <div className="mt-0.5 flex justify-center gap-0.5 sm:hidden">
                  {items.slice(0, 3).map((t) => (
                    <span key={t.id} className={cn("h-1 w-1 rounded-full", PRIORITY_DOT[t.priority])} aria-hidden="true" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
