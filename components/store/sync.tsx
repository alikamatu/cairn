"use client";

import { useEffect, useRef } from "react";
import { useHydrated } from "@/components/store/hydrated";
import { useStore } from "@/lib/store";
import {
  isEmptyPersistedState,
  pickPersistedState,
  type PersistedState,
} from "@/lib/store/persist";
import { mergePersistedState } from "@/lib/store/merge";

type ServerPayload = {
  state: PersistedState | null;
  stateUpdatedAt: string | null;
};

async function fetchUserData(): Promise<ServerPayload | null> {
  const res = await fetch("/api/user/data", { credentials: "include" });
  if (!res.ok) return null;
  const body = await res.json();
  // Back-compat: older servers returned the state object directly.
  if (body && Array.isArray(body.tasks)) {
    return { state: body as PersistedState, stateUpdatedAt: null };
  }
  return {
    state: (body?.state as PersistedState | null) ?? null,
    stateUpdatedAt: (body?.stateUpdatedAt as string | null) ?? null,
  };
}

type SaveResult =
  | { ok: true; stateUpdatedAt: string }
  | { ok: false; conflict: ServerPayload }
  | { ok: false; conflict?: undefined };

async function saveUserData(
  state: PersistedState,
  baseUpdatedAt: string | null,
): Promise<SaveResult> {
  const res = await fetch("/api/user/data", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...state, baseUpdatedAt: baseUpdatedAt ?? undefined }),
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => null);
    return {
      ok: false,
      conflict: {
        state: (body?.state as PersistedState) ?? null,
        stateUpdatedAt: (body?.stateUpdatedAt as string | null) ?? null,
      },
    };
  }
  if (!res.ok) return { ok: false };
  const body = await res.json().catch(() => ({}));
  return { ok: true, stateUpdatedAt: (body.stateUpdatedAt as string) ?? new Date().toISOString() };
}

export function StoreSync() {
  const hydrated = useHydrated();
  const hasLoaded = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const lastSaved = useRef<string>("");
  const stateUpdatedAt = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let isMounted = true;

    const localState = pickPersistedState(useStore.getState());

    fetchUserData()
      .then((payload) => {
        if (!isMounted) return;
        if (payload) {
          const serverData = payload.state;
          stateUpdatedAt.current = payload.stateUpdatedAt;

          if (serverData) {
            const serverEmpty = isEmptyPersistedState(serverData);
            const localEmpty = isEmptyPersistedState(localState);

            let next: PersistedState;
            if (serverEmpty && !localEmpty) {
              next = localState;
            } else if (!serverEmpty && localEmpty) {
              next = serverData;
            } else if (!serverEmpty && !localEmpty) {
              next = mergePersistedState(localState, serverData);
            } else {
              next = serverData;
            }

            useStore.setState({ ...next, hydrated: true });
            lastSaved.current = JSON.stringify(next);

            const needsUpload =
              (serverEmpty && !localEmpty) ||
              JSON.stringify(next) !== JSON.stringify(serverData);
            if (needsUpload) {
              saveUserData(next, stateUpdatedAt.current).then((r) => {
                if (r.ok) stateUpdatedAt.current = r.stateUpdatedAt;
              }).catch(() => undefined);
            }
          }
        }
        hasLoaded.current = true;
      })
      .catch(() => {
        hasLoaded.current = true;
      });

    return () => {
      isMounted = false;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const unsubscribe = useStore.subscribe((state) => {
      const next = pickPersistedState(state);
      if (!hasLoaded.current) return;
      const serialized = JSON.stringify(next);
      if (serialized === lastSaved.current) return;
      lastSaved.current = serialized;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveUserData(next, stateUpdatedAt.current).then((r) => {
          if (r.ok) {
            stateUpdatedAt.current = r.stateUpdatedAt;
            return;
          }
          if (r.conflict?.state) {
            const merged = mergePersistedState(next, r.conflict.state);
            stateUpdatedAt.current = r.conflict.stateUpdatedAt;
            useStore.setState({ ...merged, hydrated: true });
            lastSaved.current = JSON.stringify(merged);
            saveUserData(merged, stateUpdatedAt.current).then((again) => {
              if (again.ok) stateUpdatedAt.current = again.stateUpdatedAt;
            }).catch(() => undefined);
          }
        }).catch(() => undefined);
      }, 400);
    });
    return unsubscribe;
  }, [hydrated]);

  return null;
}
