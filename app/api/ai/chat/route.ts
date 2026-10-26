import { z } from "zod";
import { GoalCtx, HabitCtx, TaskCtx, UserCtx } from "@/lib/ai/context";
import { chatSystem } from "@/lib/ai/prompts";
import { streamCompletion } from "@/lib/ai/stream";
import { guardAiRoute } from "@/lib/ai/guard";

const Input = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(8000),
  })).min(1).max(40),
  context: z.object({
    user:   UserCtx.optional(),
    tasks:  z.array(TaskCtx).max(60).optional(),
    habits: z.array(HabitCtx).max(30).optional(),
    goals:  z.array(GoalCtx).max(20).optional(),
  }).optional(),
});

export async function POST(req: Request) {
  const gate = await guardAiRoute();
  if (!gate.ok) return gate.response;
  const { session } = gate;

  const json = await req.json().catch(() => null);
  const parsed = Input.safeParse(json);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0]?.message ?? "invalid", { status: 400 });
  }

  const ctx = parsed.data.context ?? {};
  const system = chatSystem({
    user:   ctx.user   ?? { name: session.name, timezone: session.timezone, startOfWeek: session.startOfWeek },
    tasks:  ctx.tasks,
    habits: ctx.habits,
    goals:  ctx.goals,
  });

  const stream = streamCompletion({
    system,
    messages: parsed.data.messages,
    maxTokens: 1200,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
