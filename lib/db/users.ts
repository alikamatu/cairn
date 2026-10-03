import type { Session } from "@/lib/auth/session";
import type {
  Task, Habit, Goal, Project, Note, Review, Conversation,
} from "@/types/entities";
import { getDb } from "./mongo";

export type UserProfile = Omit<Session, "iat" | "exp">;

export type UserState = {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  projects: Project[];
  notes: Note[];
  reviews: Review[];
  conversations: Conversation[];
};

export type UserDoc = {
  _id: string;
  email: string;
  profile: UserProfile;
  state: UserState;
  createdAt: string;
  updatedAt: string;
};

export const emptyUserState: UserState = {
  tasks: [],
  habits: [],
  goals: [],
  projects: [],
  notes: [],
  reviews: [],
  conversations: [],
};

export async function findOrCreateUserByEmail(
  email: string,
  profile: Partial<UserProfile> = {},
): Promise<UserDoc> {
  const normalized = email.toLowerCase();
  const now = new Date().toISOString();

  const defaults: UserProfile = {
    email: normalized,
    name: profile.name,
    avatarId: profile.avatarId,
    avatarUrl: profile.avatarUrl,
    timezone: profile.timezone,
    theme: profile.theme ?? "obsidian",
    startOfWeek: profile.startOfWeek ?? "mon",
    onboarded: profile.onboarded ?? false,
    plan: profile.plan ?? "free",
    planInterval: profile.planInterval ?? null,
    planRenewsAt: profile.planRenewsAt ?? null,
    paystackCustomerCode: profile.paystackCustomerCode ?? null,
    emailDigest: profile.emailDigest ?? "weekly",
  };

  try {
    const db = await getDb();
    const users = db.collection<UserDoc>("users");
    const result = await users.findOneAndUpdate(
      { email: normalized },
      {
        $setOnInsert: {
          email: normalized,
          profile: defaults,
          state: emptyUserState,
          createdAt: now,
        },
        $set: {
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    if (result) {
      return result as UserDoc;
    }
  } catch (err) {
    console.warn("[db] MongoDB unavailable in findOrCreateUserByEmail, falling back to local session:", (err as Error).message);
  }

  // Graceful fallback: return doc with defaults so sign-in is not blocked by DB network issues
  return {
    _id: normalized,
    email: normalized,
    profile: defaults,
    state: emptyUserState,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getUserByEmail(email: string): Promise<UserDoc | null> {
  try {
    const db = await getDb();
    const users = db.collection<UserDoc>("users");
    return await users.findOne({ email: email.toLowerCase() });
  } catch (err) {
    console.warn("[db] MongoDB unavailable in getUserByEmail:", (err as Error).message);
    return null;
  }
}

export async function updateUserProfile(email: string, patch: Partial<UserProfile>) {
  try {
    const db = await getDb();
    const users = db.collection<UserDoc>("users");
    const normalized = email.toLowerCase();
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      update[`profile.${key}`] = value;
    }
    await users.updateOne(
      { email: normalized },
      {
        $set: update,
        $setOnInsert: { email: normalized, profile: { email: normalized, theme: "obsidian", startOfWeek: "mon", onboarded: false }, state: emptyUserState, createdAt: new Date().toISOString() },
      },
      { upsert: true },
    );
  } catch (err) {
    console.warn("[db] MongoDB unavailable in updateUserProfile:", (err as Error).message);
  }
}

export async function getUserState(email: string): Promise<UserState | null> {
  const user = await getUserByEmail(email);
  return user?.state ?? null;
}

export async function setUserState(email: string, state: UserState) {
  try {
    const db = await getDb();
    const users = db.collection<UserDoc>("users");
    await users.updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          state,
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: {
          email: email.toLowerCase(),
          profile: {
            email: email.toLowerCase(),
            theme: "obsidian",
            startOfWeek: "mon",
            onboarded: false,
          },
          createdAt: new Date().toISOString(),
        },
      },
      {
        upsert: true,
      },
    );
  } catch (err) {
    console.warn("[db] MongoDB unavailable in setUserState:", (err as Error).message);
  }
}
