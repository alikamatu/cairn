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

/** Default profile fields as dotted paths — avoids Mongo parent/child path conflicts with $set. */
function profileInsertDefaults(email: string, profile: Partial<UserProfile> = {}) {
  const fields: Record<string, unknown> = {
    "profile.email": email,
    "profile.theme": profile.theme ?? "obsidian",
    "profile.startOfWeek": profile.startOfWeek ?? "mon",
    "profile.onboarded": profile.onboarded ?? false,
    "profile.plan": profile.plan ?? "free",
    "profile.planInterval": profile.planInterval ?? null,
    "profile.planRenewsAt": profile.planRenewsAt ?? null,
    "profile.paystackCustomerCode": profile.paystackCustomerCode ?? null,
    "profile.emailDigest": profile.emailDigest ?? "weekly",
  };
  if (profile.name !== undefined) fields["profile.name"] = profile.name;
  if (profile.avatarId !== undefined) fields["profile.avatarId"] = profile.avatarId;
  if (profile.avatarUrl !== undefined) fields["profile.avatarUrl"] = profile.avatarUrl;
  if (profile.timezone !== undefined) fields["profile.timezone"] = profile.timezone;
  return fields;
}

function toProfile(email: string, profile: Partial<UserProfile> = {}): UserProfile {
  return {
    email,
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
}

export async function findOrCreateUserByEmail(
  email: string,
  profile: Partial<UserProfile> = {},
): Promise<UserDoc> {
  const normalized = email.toLowerCase();
  const now = new Date().toISOString();
  const defaults = toProfile(normalized, profile);

  try {
    const db = await getDb();
    const users = db.collection<UserDoc>("users");

    // Only refresh OAuth identity fields on existing users — never overwrite onboarded.
    const setFields: Record<string, unknown> = { updatedAt: now };
    if (profile.name) setFields["profile.name"] = profile.name;
    if (profile.avatarUrl) setFields["profile.avatarUrl"] = profile.avatarUrl;

    const result = await users.findOneAndUpdate(
      { email: normalized },
      {
        $setOnInsert: {
          email: normalized,
          ...profileInsertDefaults(normalized, profile),
          state: emptyUserState,
          createdAt: now,
        },
        $set: setFields,
      },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    if (result) {
      // Normalize in case an older doc stored a partial profile object
      const doc = result as UserDoc;
      if (!doc.profile || typeof doc.profile !== "object") {
        doc.profile = defaults;
      } else {
        doc.profile = { ...defaults, ...doc.profile, email: normalized };
      }
      return doc;
    }
  } catch (err) {
    console.warn("[db] MongoDB unavailable in findOrCreateUserByEmail, falling back to local session:", (err as Error).message);
  }

  // Graceful fallback: try to recover onboarded state from the existing session cookie
  // so we don't force re-onboarding when the DB is temporarily unreachable
  let existingOnboarded = defaults.onboarded;
  try {
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();
    if (session?.email === normalized && session.onboarded) {
      existingOnboarded = true;
    }
  } catch { /* no session available */ }

  return {
    _id: normalized,
    email: normalized,
    profile: { ...defaults, onboarded: existingOnboarded },
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
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updatedAt: now };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      update[`profile.${key}`] = value;
    }
    await users.updateOne(
      { email: normalized },
      {
        $set: update,
        $setOnInsert: {
          email: normalized,
          ...profileInsertDefaults(normalized),
          state: emptyUserState,
          createdAt: now,
        },
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
    const normalized = email.toLowerCase();
    const now = new Date().toISOString();
    await users.updateOne(
      { email: normalized },
      {
        $set: {
          state,
          updatedAt: now,
        },
        $setOnInsert: {
          email: normalized,
          ...profileInsertDefaults(normalized),
          createdAt: now,
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
