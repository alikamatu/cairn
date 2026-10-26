import { z } from "zod";
import { GoalCtx, HabitCtx, TaskCtx, UserCtx } from "@/lib/ai/context";
import { diagnoseSystem } from "@/lib/ai/prompts";
import { streamCompletion } from "@/lib/ai/stream";
import {
  describeGoals, describeHabits, describeTasks,
} from "@/lib/ai/context";
import { guardAiRoute } from "@/lib/ai/guard";

const Input = z.object({
  goal: GoalCtx,
  tasks: z.array(TaskCtx).max(40).optional(),
  habits: z.array(HabitCtx).max(20).optional(),
  user: UserCtx.optional(),
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

  const userCtx = parsed.data.user ?? {
    name: session.name, timezone: session.timezone, startOfWeek: session.startOfWeek,
  };

  const userMsg = [
    `# Goal in focus`,
    describeGoals([parsed.data.goal]),
    parsed.data.goal.why ? `\nWhy: ${parsed.data.goal.why}` : "",
    "",
    `# Linked tasks`,
    describeTasks(parsed.data.tasks ?? []),
    "",
    `# Linked habits`,
    describeHabits(parsed.data.habits ?? []),
  ].join("\n");

  const stream = streamCompletion({
    system: diagnoseSystem(userCtx),
    messages: [{ role: "user", content: userMsg }],
    maxTokens: 600,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
