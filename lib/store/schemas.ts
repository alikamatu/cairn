import { z } from "zod";

const SoftDelete = z.object({
  deletedAt: z.string().nullable().optional(),
});

const Priority = z.enum(["low", "med", "high"]);
const TaskStatus = z.enum(["open", "in-progress", "done"]);

export const TaskSchema = SoftDelete.extend({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  notes: z.string().max(20_000).optional(),
  status: TaskStatus,
  priority: Priority,
  projectId: z.string().max(64).nullable().optional(),
  labels: z.array(z.string().max(64)).max(40),
  due: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
  parentId: z.string().max(64).nullable().optional(),
  inbox: z.boolean().optional(),
  order: z.number(),
  createdAt: z.string().min(1),
});

const HabitCadence = z.union([
  z.object({ kind: z.literal("daily") }),
  z.object({ kind: z.literal("weekly-target"), perWeek: z.number().int().min(1).max(7) }),
  z.object({
    kind: z.literal("custom"),
    days: z.array(z.union([
      z.literal(0), z.literal(1), z.literal(2), z.literal(3),
      z.literal(4), z.literal(5), z.literal(6),
    ])).max(7),
  }),
]);

export const HabitSchema = SoftDelete.extend({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  notes: z.string().max(20_000).optional(),
  cadence: HabitCadence,
  reminderTime: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  checkins: z.record(z.string(), z.boolean()),
  createdAt: z.string().min(1),
});

const Milestone = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  progress: z.number().min(0).max(100),
  done: z.boolean(),
});

export const GoalSchema = SoftDelete.extend({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  why: z.string().max(5000).optional(),
  horizon: z.enum(["quarter", "year", "life"]),
  status: z.enum(["on-track", "at-risk", "off-track", "achieved", "archived"]),
  milestones: z.array(Milestone).max(50),
  taskIds: z.array(z.string().max(64)).max(200),
  habitIds: z.array(z.string().max(64)).max(100),
  targetDate: z.string().nullable().optional(),
  createdAt: z.string().min(1),
});

export const ProjectSchema = SoftDelete.extend({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  color: z.string().max(64),
  archived: z.boolean(),
  goalIds: z.array(z.string().max(64)).max(100),
  createdAt: z.string().min(1),
});

export const NoteSchema = SoftDelete.extend({
  id: z.string().min(1).max(64),
  title: z.string().max(500),
  body: z.string().max(200_000),
  tags: z.array(z.string().max(64)).max(50),
  taskIds: z.array(z.string().max(64)).max(200),
  goalIds: z.array(z.string().max(64)).max(100),
  pinned: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ReviewSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(["daily", "weekly", "monthly", "yearly"]),
  periodStart: z.string().min(1),
  content: z.record(z.string(), z.string().max(20_000)),
  createdAt: z.string().min(1),
});

const ChatMessage = z.object({
  id: z.string().min(1).max(64),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(40_000),
  createdAt: z.string().min(1),
});

export const ConversationSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(500),
  messages: z.array(ChatMessage).max(200),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

/** Caps keep a single POST from blowing memory. */
export const UserStateSchema = z.object({
  tasks: z.array(TaskSchema).max(5_000),
  habits: z.array(HabitSchema).max(500),
  goals: z.array(GoalSchema).max(500),
  projects: z.array(ProjectSchema).max(500),
  notes: z.array(NoteSchema).max(2_000),
  reviews: z.array(ReviewSchema).max(2_000),
  conversations: z.array(ConversationSchema).max(200),
});

export const UserStateSyncSchema = UserStateSchema.extend({
  /** Client's last known server revision; used for optimistic concurrency. */
  baseUpdatedAt: z.string().optional(),
});
