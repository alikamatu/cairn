"use client";

import { useEffect, useMemo, useState } from "react";
import { Reorder, motion, AnimatePresence } from "motion/react";
import { Flame, GripVertical, Trash2, Circle, CheckCircle2, Clock3 } from "lucide-react";
import { Topbar } from "@/components/app/topbar";
import { Pomodoro } from "./pomodoro";
import { PlanMyDayModal } from "./plan-my-day";
import { DailyQuote } from "./daily-quote";
import { NewsWidget } from "./news";
import { BreathingWidget } from "./breathing";
import { useKeyboard } from "@/components/keyboard/keyboard-provider";
import { useStore } from "@/lib/store";
import { useLiveTasks, useLiveHabits } from "@/lib/store/selectors";
import { currentStreak, isDoneToday, ymd } from "@/lib/domain/habits";
import { cn } from "@/lib/utils/cn";
import type { Task, Habit } from "@/types/entities";

export function TodayBoard({ greeting, date }: { greeting: string; date: string }) {
  const tasks    = useLiveTasks();
  const habits   = useLiveHabits();
  const toggle   = useStore((s) => s.toggleTask);
  const reorder  = useStore((s) => s.reorderTasks);
  const remove   = useStore((s) => s.deleteTask);
  const toggleH  = useStore((s) => s.toggleHabitDay);
  const addTask  = useStore((s) => s.addTask);
  const addHabit = useStore((s) => s.addHabit);
  const addNote  = useStore((s) => s.addNote);
  const { openQuickAdd } = useKeyboard();
  const [planOpen, setPlanOpen] = useState(false);

  // Today scope: tasks marked inbox=true (today board) plus open tasks due today.
  const todayTasks = useMemo(() => {
    const todayKey = ymd(new Date());
    return tasks
      .filter((t) =>
        t.inbox ||
        (t.due && ymd(t.due) === todayKey) ||
        (t.status === "done" && t.completedAt && ymd(t.completedAt) === todayKey),
      )
      .sort((a, b) => a.order - b.order);
  }, [tasks]);

  const completed = todayTasks.filter((t) => t.status === "done").length;
  const habitDone = habits.filter((h) => isDoneToday(h)).length;
  const taskPct = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0;
  const habitPct = habits.length ? Math.round((habitDone / habits.length) * 100) : 0;

  return (
    <>
      <Topbar
        greeting={greeting}
        date={date}
        onQuickAdd={openQuickAdd}
        onPlanMyDay={() => setPlanOpen(true)}
      />

      <div className="grid grid-cols-1 gap-6 px-4 pb-24 sm:px-6 md:px-10 md:pb-10 lg:grid-cols-[1fr_320px]">
        <main className="min-w-0 space-y-6">
          <DailyQuote />

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <ProgressCard label="Tasks"  value={`${completed} / ${todayTasks.length}`} pct={taskPct} />
            <ProgressCard label="Habits" value={`${habitDone} / ${habits.length}`}     pct={habitPct} />
          </div>

          <HabitsRow habits={habits} onToggle={(id) => toggleH(id, ymd(new Date()))} />

          <TasksList
            tasks={todayTasks}
            onToggle={toggle}
            onDelete={remove}
            onReorder={(ordered) => reorder(ordered.map((t) => t.id))}
          />
          
          <NewsWidget />
        </main>

        <aside className="space-y-6">
          <Pomodoro />
          <SchedulePreview tasks={todayTasks} />
          <BreathingWidget />
        </aside>
      </div>

      <PlanMyDayModal open={planOpen} onOpenChange={setPlanOpen} />
    </>
  );
}

function ProgressCard({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="rounded-2xl bg-surface-1 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-fg-muted">{pct}%</span>
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-tight text-fg">{value}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function HabitsRow({ habits, onToggle }: { habits: Habit[]; onToggle: (id: string) => void }) {
  return (
    <section>
      <SectionHead title="Today's habits" hint={`${habits.length} tracked`} />
      <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-4 scrollbar-hide [&::-webkit-scrollbar]:hidden">
        {habits.map((h) => {
          const done = isDoneToday(h);
          const streak = currentStreak(h);
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onToggle(h.id)}
              className={cn(
                "group relative flex h-[112px] w-[160px] shrink-0 flex-col justify-between rounded-2xl p-3 text-left",
                "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.015]",
                done ? "bg-accent text-accent-fg" : "bg-surface-1",
              )}
              aria-pressed={done}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  done ? "bg-black/15 text-accent-fg" : "bg-surface-2 text-fg-muted",
                )}>
                  <Flame size={11} strokeWidth={2.25} />
                  {streak}
                </span>
                {done
                  ? <CheckCircle2 size={18} strokeWidth={2} />
                  : <Circle size={18} strokeWidth={1.75} className="text-fg-subtle" />}
              </div>
              <div className={cn("text-[14px] font-semibold leading-snug", done ? "text-accent-fg" : "text-fg")}>
                {h.title}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TasksList({
  tasks, onToggle, onDelete, onReorder,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (next: Task[]) => void;
}) {
  const open = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const done = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);

  return (
    <section>
      <SectionHead title="Today's tasks" hint={`${open.length} open · ${done.length} done`} />

      <Reorder.Group
        axis="y"
        values={open}
        onReorder={(next) => onReorder([...next, ...done])}
        className="mt-3 space-y-1.5"
      >
        <AnimatePresence initial={false}>
          {open.map((t) => (
            <Reorder.Item key={t.id} value={t} className="list-none" whileDrag={{ scale: 1.01 }}>
              <TaskRow task={t} onToggle={onToggle} onDelete={onDelete} />
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {done.length > 0 && (
        <>
          <div className="mt-6 mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Completed
          </div>
          <ul className="space-y-1.5">
            {done.map((t) => (
              <li key={t.id}><TaskRow task={t} onToggle={onToggle} onDelete={onDelete} /></li>
            ))}
          </ul>
        </>
      )}

      {tasks.length === 0 && (
        <div className="mt-3 rounded-2xl bg-surface-1 p-8 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-fg-muted">
            <CheckCircle2 size={18} strokeWidth={1.75} />
          </div>
          <h3 className="mt-3 text-[15px] font-semibold text-fg">Clear day</h3>
          <p className="mt-1 text-[13px] text-fg-muted">
            Press <kbd className="rounded bg-surface-2 px-1 font-mono">N</kbd> to add your first task.
          </p>
        </div>
      )}
    </section>
  );
}

const PRIORITY_DOT = {
  low:  "bg-fg-subtle",
  med:  "bg-warning",
  high: "bg-danger",
} as const;

function TaskRow({
  task, onToggle, onDelete,
}: { task: Task; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const done = task.status === "done";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="group flex items-center gap-2 rounded-xl bg-surface-1 px-2 py-2 pl-1 hover:bg-surface-2"
    >
      <span className="cursor-grab text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
        <GripVertical size={14} strokeWidth={1.75} />
      </span>

      <button
        type="button"
        onClick={() => onToggle(task.id)}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className="grid h-6 w-6 place-items-center rounded-md text-fg-subtle hover:text-fg"
      >
        {done
          ? <CheckCircle2 size={18} strokeWidth={2} className="text-accent" />
          : <Circle size={18} strokeWidth={1.75} />}
      </button>

      <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[task.priority])} />

      <a href={`/tasks/${task.id}`} className={cn(
        "flex-1 truncate text-[14px]",
        done ? "text-fg-subtle line-through" : "text-fg",
      )}>
        {task.title}
      </a>

      {task.dueTime && (
        <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">
          <Clock3 size={11} strokeWidth={2} />
          {task.dueTime}
        </span>
      )}

      <button
        type="button"
        onClick={() => onDelete(task.id)}
        className="grid h-7 w-7 place-items-center rounded-md text-fg-subtle opacity-0 transition-opacity hover:bg-surface-3 hover:text-[color:var(--danger)] group-hover:opacity-100"
        aria-label="Delete task"
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </button>
    </motion.div>
  );
}

function SchedulePreview({ tasks }: { tasks: Task[] }) {
  const scheduled = tasks
    .filter((t) => t.dueTime && t.status !== "done")
    .sort((a, b) => (a.dueTime ?? "").localeCompare(b.dueTime ?? ""));
  if (scheduled.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-1 p-5">
        <SectionHead title="Schedule" hint="No time blocks" />
        <p className="mt-2 text-[13px] text-fg-muted">
          Add times to tasks to see them stacked here.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-surface-1 p-5">
      <SectionHead title="Schedule" hint={`${scheduled.length} blocks`} />
      <ul className="mt-3 space-y-1.5">
        {scheduled.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
            <span className="font-mono text-[12px] tabular-nums text-fg-muted">{t.dueTime}</span>
            <span className="flex-1 truncate text-[13px] text-fg">{t.title}</span>
            <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[t.priority])} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      {hint && <span className="text-[11px] uppercase tracking-[0.14em] text-fg-subtle">{hint}</span>}
    </div>
  );
}
