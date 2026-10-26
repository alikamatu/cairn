import { NextResponse } from "next/server";
import { z } from "zod";
import { UserCtx } from "@/lib/ai/context";
import { breakdownSystem } from "@/lib/ai/prompts";
import { complete, classifyAiError } from "@/lib/ai/stream";
import { guardAiRoute } from "@/lib/ai/guard";

const Input = z.object({
  title: z.string().min(1).max(280),
  notes: z.string().max(2000).optional(),
  user: UserCtx.optional(),
});

export async function POST(req: Request) {
  const gate = await guardAiRoute();
  if (!gate.ok) {
    if (gate.response.headers.get("content-type")?.includes("application/json")) {
      return gate.response;
    }
    return NextResponse.json({ error: "unauthorized" }, { status: gate.response.status });
  }
  const { session } = gate;

  const json = await req.json().catch(() => null);
  const parsed = Input.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const userCtx = parsed.data.user ?? {
    name: session.name, timezone: session.timezone, startOfWeek: session.startOfWeek,
  };

  const userMsg = parsed.data.notes
    ? `Task: ${parsed.data.title}\n\nNotes:\n${parsed.data.notes}`
    : `Task: ${parsed.data.title}`;

  try {
    const text = await complete({
      system: breakdownSystem(userCtx),
      messages: [{ role: "user", content: userMsg }],
      maxTokens: 400,
    });

    let subtasks: string[] = [];
    try {
      const stripped = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsedJson = JSON.parse(stripped);
      if (Array.isArray(parsedJson)) {
        subtasks = parsedJson
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .slice(0, 8);
      }
    } catch {
      // Fall back: split on newlines and clean up.
      subtasks = text
        .split(/\r?\n/)
        .map((l) => l.replace(/^[\s\-\d.*)\]]+/, "").trim())
        .filter((l) => l.length > 0)
        .slice(0, 6);
    }

    if (subtasks.length === 0) {
      return NextResponse.json({ error: "Empty response from model." }, { status: 502 });
    }
    return NextResponse.json({ subtasks });
  } catch (err) {
    const f = classifyAiError(err);
    return NextResponse.json({ error: f.title, detail: f.body, kind: f.kind }, { status: 502 });
  }
}
