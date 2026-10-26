import { z } from "zod";
import { HabitCtx, TaskCtx, UserCtx } from "@/lib/ai/context";
import {
  describeHabits, describeTasks,
} from "@/lib/ai/context";
import { planSystem } from "@/lib/ai/prompts";
import { streamCompletion } from "@/lib/ai/stream";
import { guardAiRoute } from "@/lib/ai/guard";

const Input = z.object({
  tasks: z.array(TaskCtx).max(60).optional(),
  habits: z.array(HabitCtx).max(30).optional(),
  user: UserCtx.optional(),
  /** Optional free-text hints — e.g. "I have a 2pm meeting". */
  hints: z.string().max(800).optional(),
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

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: userCtx.timezone ?? "UTC",
  });

  const userMsg = [
    `Today: ${today}`,
    "",
    describeTasks(parsed.data.tasks ?? []),
    "",
    describeHabits(parsed.data.habits ?? []),
    "",
    parsed.data.hints ? `User constraints / context for today:\n${parsed.data.hints}` : "",
    "",
    "Propose a schedule.",
  ].join("\n");

  const stream = streamCompletion({
    system: planSystem(userCtx),
    messages: [{ role: "user", content: userMsg }],
    maxTokens: 700,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
