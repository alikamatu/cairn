import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  findOrCreateUserByEmail,
  getUserStateWithMeta,
  setUserState,
  type UserState,
} from "@/lib/db/users";
import { UserStateSyncSchema } from "@/lib/store/schemas";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await findOrCreateUserByEmail(session.email, session);
  const meta = await getUserStateWithMeta(session.email);
  return NextResponse.json(
    {
      state: meta?.state ?? null,
      stateUpdatedAt: meta?.stateUpdatedAt ?? null,
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = await rateLimit(`user-data:${session.email}`, 120, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = UserStateSyncSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const { baseUpdatedAt, ...stateFields } = parsed.data;
  const state = stateFields as UserState;

  await findOrCreateUserByEmail(session.email, session);
  const result = await setUserState(session.email, state, baseUpdatedAt);

  if (!result.ok && result.conflict) {
    return NextResponse.json(
      {
        error: "conflict",
        state: result.state,
        stateUpdatedAt: result.stateUpdatedAt,
      },
      { status: 409 },
    );
  }

  if (!result.ok) {
    return NextResponse.json({ error: "persist_failed" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, stateUpdatedAt: result.stateUpdatedAt });
}
