import { z } from "zod";
import { GoalCtx, HabitCtx, TaskCtx, UserCtx } from "@/lib/ai/context";
import { noteSystem } from "@/lib/ai/prompts";
import { streamCompletion } from "@/lib/ai/stream";
import { guardAiRoute } from "@/lib/ai/guard";

const Mode = z.enum([
  "continue", "summarize", "improve", "outline", "plan", "ask", "expand", "journal-prompts",
]);

const Input = z.object({
  mode: Mode,
  title: z.string().max(280).optional(),
  body:  z.string().max(40_000).default(""),
  /** Optional free-text instruction. Required for "ask"; helps "plan". */
  instruction: z.string().max(2_000).optional(),
  /** Optional selected text — when present, the model focuses on this slice. */
  selection: z.string().max(8_000).optional(),
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

  const { mode, title, body, instruction, selection, context } = parsed.data;
  const userCtx = context?.user ?? {
    name: session.name, timezone: session.timezone, startOfWeek: session.startOfWeek,
  };

  const system = noteSystem(mode, userCtx, {
    tasks: context?.tasks, habits: context?.habits, goals: context?.goals,
  });

  const sections: string[] = [];
  if (title) sections.push(`# Note title\n${title}`);
  if (body)  sections.push(`# Current note body\n${body}`);
  if (selection) sections.push(`# Selected slice (focus on this)\n${selection}`);
  if (mode === "ask" || instruction) {
    sections.push(`# Instruction\n${instruction ?? "Help me with this note."}`);
  } else if (mode === "plan") {
    sections.push(`# Instruction\n${instruction ?? "Turn the relevant bits of this note into a concrete plan I can act on this week."}`);
  } else if (mode === "journal-prompts") {
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", timeZone: userCtx.timezone ?? "UTC",
    });
    sections.push(`# Date\n${today}`);
  }

  const userMsg = sections.join("\n\n") || "Help me with this note.";

  const stream = streamCompletion({
    system,
    messages: [{ role: "user", content: userMsg }],
    maxTokens: mode === "summarize" || mode === "journal-prompts" ? 500 : 900,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
