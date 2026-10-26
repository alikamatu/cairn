"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ChatMessage, Conversation, Goal, GoalHorizon, Habit, Milestone, Note,
  Priority, Project, Review, ReviewKind, Task, TaskStatus, TrashableKind,
} from "@/types/entities";
import { TRASH_RETENTION_DAYS } from "@/types/entities";
import { emptyPersistedState } from "./persist";
import { buildSeed } from "./seed";

type State = {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  projects: Project[];
  notes: Note[];
  reviews: Review[];
  conversations: Conversation[];
  hydrated: boolean;

  // tasks
  addTask: (p: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (ids: string[]) => void;

  // habits
  addHabit: (p: Partial<Habit> & { title: string }) => Habit;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  toggleHabitDay: (id: string, ymd: string) => void;
  deleteHabit: (id: string) => void;

  // goals
  addGoal: (p: Partial<Goal> & { title: string; horizon: GoalHorizon }) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  addMilestone: (goalId: string, title: string) => void;
  updateMilestone: (goalId: string, ms: Milestone) => void;
  deleteMilestone: (goalId: string, msId: string) => void;
  deleteGoal: (id: string) => void;

  // projects
  addProject: (p: Partial<Project> & { name: string }) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // notes
  addNote: (p?: Partial<Note>) => Note;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  /** Return today's journal note for the given timezone, creating it if missing. */
  getOrCreateTodaysJournal: (timezone?: string) => Note;

  // reviews
  saveReview: (kind: ReviewKind, periodStart: string, content: Record<string, string>) => Review;

  // assistant
  addConversation: (title?: string) => Conversation;
  appendMessage: (cid: string, m: Omit<ChatMessage, "id" | "createdAt">) => void;
  renameConversation: (cid: string, title: string) => void;
  deleteConversation: (cid: string) => void;

  // trash
  restore: (kind: TrashableKind, id: string) => void;
  purge: (kind: TrashableKind, id: string) => void;
  purgeAllTrash: () => void;
  /** Auto-purge soft-deleted items older than 30 days. Called on store rehydrate. */
  sweepExpiredTrash: () => void;

  // dev
  reset: () => void;
};

const now = () => new Date().toISOString();

export const useStore = create<State>()(
  persist(
    (set, get) => {
      return {
        ...emptyPersistedState,
        hydrated: false,

        // ─── tasks ───────────────────────────────────────────────
        addTask: (p) => {
          const t: Task = {
            id: nanoid(8),
            title: p.title,
            status: p.status ?? "open",
            priority: (p.priority as Priority | undefined) ?? "med",
            projectId: p.projectId ?? null,
            labels: p.labels ?? [],
            due: p.due ?? null,
            dueTime: p.dueTime ?? null,
            completedAt: null,
            recurrence: p.recurrence ?? "none",
            parentId: p.parentId ?? null,
            inbox: p.inbox ?? false,
            order: -Date.now(),
            createdAt: now(),
            notes: p.notes,
          };
          set((s) => ({ tasks: [t, ...s.tasks] }));
          return t;
        },
        updateTask: (id, patch) =>
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
        toggleTask: (id) =>
          set((s) => ({
            tasks: s.tasks.map((t) => {
              if (t.id !== id) return t;
              const done = t.status !== "done";
              return {
                ...t,
                status: (done ? "done" : "open") as TaskStatus,
                completedAt: done ? now() : null,
              };
            }),
          })),
        deleteTask: (id) =>
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, deletedAt: now() } : t)) })),
        reorderTasks: (ids) =>
          set((s) => {
            const map = new Map(s.tasks.map((t) => [t.id, t]));
            const ordered = ids.map((id, i) => {
              const t = map.get(id);
              return t ? { ...t, order: i } : null;
            }).filter(Boolean) as Task[];
            const rest = s.tasks.filter((t) => !ids.includes(t.id));
            return { tasks: [...ordered, ...rest] };
          }),

        // ─── habits ──────────────────────────────────────────────
        addHabit: (p) => {
          const h: Habit = {
            id: nanoid(8),
            title: p.title,
            notes: p.notes,
            cadence: p.cadence ?? { kind: "daily" },
            reminderTime: p.reminderTime ?? null,
            startDate: p.startDate ?? null,
            checkins: {},
            createdAt: now(),
          };
          set((s) => ({ habits: [...s.habits, h] }));
          return h;
        },
        updateHabit: (id, patch) =>
          set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
        toggleHabitDay: (id, ymd) =>
          set((s) => ({
            habits: s.habits.map((h) => {
              if (h.id !== id) return h;
              const next = { ...h.checkins };
              if (next[ymd]) delete next[ymd]; else next[ymd] = true;
              return { ...h, checkins: next };
            }),
          })),
        deleteHabit: (id) =>
          set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, deletedAt: now() } : h)) })),

        // ─── goals ───────────────────────────────────────────────
        addGoal: (p) => {
          const g: Goal = {
            id: nanoid(8),
            title: p.title,
            why: p.why ?? "",
            horizon: p.horizon,
            status: p.status ?? "on-track",
            milestones: p.milestones ?? [],
            taskIds: p.taskIds ?? [],
            habitIds: p.habitIds ?? [],
            targetDate: p.targetDate ?? null,
            createdAt: now(),
          };
          set((s) => ({ goals: [g, ...s.goals] }));
          return g;
        },
        updateGoal: (id, patch) =>
          set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
        addMilestone: (goalId, title) =>
          set((s) => ({
            goals: s.goals.map((g) =>
              g.id === goalId
                ? { ...g, milestones: [...g.milestones, { id: nanoid(6), title, progress: 0, done: false }] }
                : g,
            ),
          })),
        updateMilestone: (goalId, ms) =>
          set((s) => ({
            goals: s.goals.map((g) =>
              g.id === goalId
                ? { ...g, milestones: g.milestones.map((m) => (m.id === ms.id ? ms : m)) }
                : g,
            ),
          })),
        deleteMilestone: (goalId, msId) =>
          set((s) => ({
            goals: s.goals.map((g) =>
              g.id === goalId ? { ...g, milestones: g.milestones.filter((m) => m.id !== msId) } : g,
            ),
          })),
        deleteGoal: (id) =>
          set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, deletedAt: now() } : g)) })),

        // ─── projects ────────────────────────────────────────────
        addProject: (p) => {
          const proj: Project = {
            id: nanoid(8),
            name: p.name,
            description: p.description ?? "",
            color: p.color ?? "accent",
            archived: p.archived ?? false,
            goalIds: p.goalIds ?? [],
            createdAt: now(),
          };
          set((s) => ({ projects: [...s.projects, proj] }));
          return proj;
        },
        updateProject: (id, patch) =>
          set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
        deleteProject: (id) =>
          set((s) => ({
            projects: s.projects.map((p) => (p.id === id ? { ...p, deletedAt: now() } : p)),
            tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
          })),

        // ─── notes ───────────────────────────────────────────────
        addNote: (p) => {
          const n: Note = {
            id: nanoid(8),
            title: p?.title ?? "Untitled",
            body: p?.body ?? "",
            tags: p?.tags ?? [],
            taskIds: p?.taskIds ?? [],
            goalIds: p?.goalIds ?? [],
            pinned: p?.pinned ?? false,
            createdAt: now(),
            updatedAt: now(),
          };
          set((s) => ({ notes: [n, ...s.notes] }));
          return n;
        },
        updateNote: (id, patch) =>
          set((s) => ({
            notes: s.notes.map((n) =>
              n.id === id ? { ...n, ...patch, updatedAt: now() } : n,
            ),
          })),
        deleteNote: (id) =>
          set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, deletedAt: now() } : n)) })),
        getOrCreateTodaysJournal: (timezone) => {
          const tz = timezone || "UTC";
          const ymd = (() => {
            try {
              return new Intl.DateTimeFormat("en-CA", {
                timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
              }).format(new Date());
            } catch { return new Date().toISOString().slice(0, 10); }
          })();
          const tag = `journal-${ymd}`;
          const existing = get().notes.find((n) => !n.deletedAt && n.tags.includes(tag));
          if (existing) return existing;
          const niceDate = new Intl.DateTimeFormat("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz,
          }).format(new Date());
          const seed = `# Journal · ${niceDate}\n\n## What mattered today\n- \n\n## What I'm grateful for\n- \n\n## Tomorrow's one thing\n- \n`;
          const created = (get().addNote)({
            title: `Journal · ${niceDate}`,
            body: seed,
            tags: ["journal", tag],
            pinned: false,
          });
          return created;
        },

        // ─── reviews ─────────────────────────────────────────────
        saveReview: (kind, periodStart, content) => {
          const r: Review = { id: nanoid(8), kind, periodStart, content, createdAt: now() };
          set((s) => {
            // upsert by (kind, periodStart)
            const filtered = s.reviews.filter((x) => !(x.kind === kind && x.periodStart === periodStart));
            return { reviews: [r, ...filtered] };
          });
          return r;
        },

        // ─── assistant ───────────────────────────────────────────
        addConversation: (title) => {
          const c: Conversation = {
            id: nanoid(8),
            title: title ?? "New conversation",
            messages: [],
            createdAt: now(),
            updatedAt: now(),
          };
          set((s) => ({ conversations: [c, ...s.conversations] }));
          return c;
        },
        appendMessage: (cid, m) =>
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === cid
                ? {
                    ...c,
                    messages: [...c.messages, { ...m, id: nanoid(6), createdAt: now() }],
                    updatedAt: now(),
                  }
                : c,
            ),
          })),
        renameConversation: (cid, title) =>
          set((s) => ({
            conversations: s.conversations.map((c) => (c.id === cid ? { ...c, title } : c)),
          })),
        deleteConversation: (cid) =>
          set((s) => ({ conversations: s.conversations.filter((c) => c.id !== cid) })),

        // ─── trash ───────────────────────────────────────────────
        restore: (kind, id) =>
          set((s) => {
            if (kind === "task")    return { tasks:    s.tasks.map((t)    => t.id === id ? { ...t, deletedAt: null } : t) };
            if (kind === "habit")   return { habits:   s.habits.map((h)   => h.id === id ? { ...h, deletedAt: null } : h) };
            if (kind === "goal")    return { goals:    s.goals.map((g)    => g.id === id ? { ...g, deletedAt: null } : g) };
            if (kind === "project") return { projects: s.projects.map((p) => p.id === id ? { ...p, deletedAt: null } : p) };
            return { notes: s.notes.map((n) => n.id === id ? { ...n, deletedAt: null } : n) };
          }),
        purge: (kind, id) =>
          set((s) => {
            if (kind === "task")    return { tasks:    s.tasks.filter((t)    => t.id !== id) };
            if (kind === "habit")   return { habits:   s.habits.filter((h)   => h.id !== id) };
            if (kind === "goal")    return { goals:    s.goals.filter((g)    => g.id !== id) };
            if (kind === "project") return { projects: s.projects.filter((p) => p.id !== id) };
            return { notes: s.notes.filter((n) => n.id !== id) };
          }),
        purgeAllTrash: () =>
          set((s) => ({
            tasks:    s.tasks.filter((t)    => !t.deletedAt),
            habits:   s.habits.filter((h)   => !h.deletedAt),
            goals:    s.goals.filter((g)    => !g.deletedAt),
            projects: s.projects.filter((p) => !p.deletedAt),
            notes:    s.notes.filter((n)    => !n.deletedAt),
          })),
        sweepExpiredTrash: () => {
          const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
          const expired = (d?: string | null) => d ? new Date(d).getTime() < cutoff : false;
          set((s) => ({
            tasks:    s.tasks.filter((t)    => !expired(t.deletedAt)),
            habits:   s.habits.filter((h)   => !expired(h.deletedAt)),
            goals:    s.goals.filter((g)    => !expired(g.deletedAt)),
            projects: s.projects.filter((p) => !expired(p.deletedAt)),
            notes:    s.notes.filter((n)    => !expired(n.deletedAt)),
          }));
        },

        // ─── dev ─────────────────────────────────────────────────
        reset: () => {
          const fresh = buildSeed();
          set({ ...fresh, hydrated: true });
        },
      };
    },
    {
      name: "cairn:store:v1",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") return localStorage;
        try {
          const legacy = localStorage.getItem("osama:store:v1");
          if (legacy && !localStorage.getItem("cairn:store:v1")) {
            localStorage.setItem("cairn:store:v1", legacy);
            localStorage.removeItem("osama:store:v1");
          }
        } catch { /* ignore */ }
        return localStorage;
      }),
      version: 1,
      partialize: ({ hydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hydrated = true;
          // Drop anything past the 30-day retention window.
          state.sweepExpiredTrash?.();
        }
      },
    },
  ),
);

/** Select helpers — let components subscribe to slices only. */
export const useTask     = (id: string) => useStore((s) => s.tasks.find((t) => t.id === id));
export const useHabit    = (id: string) => useStore((s) => s.habits.find((h) => h.id === id));
export const useGoal     = (id: string) => useStore((s) => s.goals.find((g) => g.id === id));
export const useProject  = (id: string) => useStore((s) => s.projects.find((p) => p.id === id));
export const useNote     = (id: string) => useStore((s) => s.notes.find((n) => n.id === id));
export const useConvo    = (id: string) => useStore((s) => s.conversations.find((c) => c.id === id));
