"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useTheme } from "@/components/theme/theme-provider";
import { THEMES, type ThemeId } from "@/lib/theme/themes";
import { cn } from "@/lib/utils/cn";
import type { Avatar } from "@/lib/avatars/store";
import { completeOnboarding } from "@/app/(auth)/onboarding/actions";

type Step = 0 | 1 | 2 | 3;

const STEP_TITLES = [
  "What should we call you?",
  "Pick your look",
  "When does your week start?",
  "You're all set",
];

const STEP_SUBS = [
  "Choose a name and an avatar.",
  "A theme you'll see every day.",
  "We'll tailor your dashboard to your timezone and week.",
  "Welcome to Cairn.",
];

export function OnboardingWizard({
  initialEmail,
  initialName,
}: {
  initialEmail: string;
  initialName?: string;
}) {
  const { theme, setTheme } = useTheme();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState(initialName ?? "");
  const [avatars, setAvatars] = useState<Avatar[] | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [startOfWeek, setStartOfWeek] = useState<"sun" | "mon">("mon");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/avatars")
      .then((r) => r.json())
      .then((d: { avatars: Avatar[] }) => {
        setAvatars(d.avatars);
        if (d.avatars[0]) setAvatarId((id) => id ?? d.avatars[0].id);
      })
      .catch(() => setAvatars([]));
  }, []);

  const canAdvance = useMemo(() => {
    if (step === 0) return name.trim().length > 0 && Boolean(avatarId);
    if (step === 1) return Boolean(theme);
    if (step === 2) return Boolean(timezone) && Boolean(startOfWeek);
    return true;
  }, [step, name, avatarId, theme, timezone, startOfWeek]);

  function next() {
    if (step < 3) setStep((s) => ((s + 1) as Step));
  }
  function back() {
    if (step > 0) setStep((s) => ((s - 1) as Step));
  }

  function submit() {
    setError(null);
    if (!avatarId) return;
    startTransition(async () => {
      const res = await completeOnboarding({
        name: name.trim(),
        avatarId,
        theme,
        timezone,
        startOfWeek,
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="w-full max-w-[560px]">
      <Progress step={step} total={4} />

      <div className="mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-fg">
              {STEP_TITLES[step]}
            </h1>
            <p className="mt-2 text-[15px] text-fg-muted">{STEP_SUBS[step]}</p>

            <div className="mt-8">
              {step === 0 && (
                <StepIdentity
                  name={name}
                  onName={setName}
                  avatars={avatars}
                  avatarId={avatarId}
                  onAvatar={setAvatarId}
                />
              )}
              {step === 1 && <StepTheme current={theme} onPick={setTheme} />}
              {step === 2 && (
                <StepPreferences
                  timezone={timezone}
                  onTimezone={setTimezone}
                  startOfWeek={startOfWeek}
                  onStartOfWeek={setStartOfWeek}
                />
              )}
              {step === 3 && (
                <StepConfirm
                  email={initialEmail}
                  name={name}
                  avatarUrl={avatars?.find((a) => a.id === avatarId)?.url}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {error && (
        <p className="mt-4 text-[13px] text-[color:var(--danger)]">{error}</p>
      )}

      <div className="mt-10 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
            "text-fg-muted hover:bg-surface-2 hover:text-fg",
            "disabled:cursor-not-allowed disabled:opacity-0",
          )}
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back
        </button>

        {step < 3 ? (
          <Button
            size="lg"
            disabled={!canAdvance}
            onClick={next}
            trailingIcon={<ArrowRight size={16} strokeWidth={2} />}
          >
            Continue
          </Button>
        ) : (
          <Button
            size="lg"
            loading={pending}
            onClick={submit}
            trailingIcon={!pending && <Check size={16} strokeWidth={2.25} />}
          >
            Enter Cairn
          </Button>
        )}
      </div>
    </div>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const active = i <= step;
        return (
          <motion.span
            key={i}
            className="h-1 flex-1 rounded-full"
            initial={false}
            animate={{
              backgroundColor: active ? "var(--accent)" : "var(--surface-2)",
            }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />
        );
      })}
    </div>
  );
}

/* ───────────────── Step 0 — Identity ───────────────── */

function StepIdentity({
  name, onName,
  avatars, avatarId, onAvatar,
}: {
  name: string;
  onName: (v: string) => void;
  avatars: Avatar[] | null;
  avatarId: string | null;
  onAvatar: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Input
        label="Display name"
        leadingIcon={<User size={16} strokeWidth={1.75} />}
        value={name}
        onChange={(e) => onName(e.target.value)}
        autoFocus
      />
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Avatar
          </span>
          {avatars && (
            <span className="text-[12px] text-fg-subtle">{avatars.length} options</span>
          )}
        </div>

        {!avatars ? (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : avatars.length === 0 ? (
          <div className="rounded-xl bg-surface-2 p-6 text-center text-sm text-fg-muted">
            No avatars available yet.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-6">
            {avatars.map((a) => {
              const active = avatarId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onAvatar(a.id)}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-xl bg-surface-2",
                    "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    "hover:scale-[1.04] focus-visible:scale-[1.04] outline-none",
                  )}
                  aria-pressed={active}
                  aria-label={a.label ?? a.id}
                >
                  <Image
                    src={a.url}
                    alt={a.label ?? a.id}
                    width={120}
                    height={120}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                  {active && (
                    <motion.span
                      layoutId="avatar-active"
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{ boxShadow: "inset 0 0 0 3px var(--accent)" }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {active && (
                    <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-fg">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────── Step 1 — Theme ───────────────── */

function StepTheme({ current, onPick }: { current: ThemeId; onPick: (t: ThemeId) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {THEMES.map((t) => {
        const active = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            className={cn(
              "relative overflow-hidden rounded-xl bg-surface-1 p-4 text-left",
              "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "hover:scale-[1.01]",
            )}
            aria-pressed={active}
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-fg">{t.label}</span>
              <span
                className="h-6 w-12 rounded-full"
                style={{ background: `linear-gradient(90deg, ${t.swatch[0]} 0 50%, ${t.swatch[1]} 50% 100%)` }}
              />
            </div>
            <div className="mt-4 flex gap-1.5">
              <span className="h-2 flex-1 rounded-full" style={{ background: t.swatch[0] }} />
              <span className="h-2 w-12 rounded-full" style={{ background: t.swatch[1] }} />
              <span className="h-2 flex-[2] rounded-full" style={{ background: t.swatch[0], opacity: 0.6 }} />
            </div>
            {active && (
              <motion.span
                layoutId="theme-card-active"
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{ boxShadow: "inset 0 0 0 2px var(--accent)" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────── Step 2 — Preferences ───────────────── */

const COMMON_TIMEZONES = [
  "UTC",
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Sao_Paulo",
  "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Istanbul",
  "Africa/Lagos", "Africa/Cairo", "Africa/Johannesburg",
  "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Bangkok", "Asia/Singapore",
  "Asia/Tokyo", "Asia/Shanghai",
  "Australia/Sydney", "Pacific/Auckland",
];

function StepPreferences({
  timezone, onTimezone,
  startOfWeek, onStartOfWeek,
}: {
  timezone: string;
  onTimezone: (v: string) => void;
  startOfWeek: "sun" | "mon";
  onStartOfWeek: (v: "sun" | "mon") => void;
}) {
  const tzOptions = useMemo(() => {
    const set = new Set<string>(COMMON_TIMEZONES);
    if (timezone) set.add(timezone);
    return Array.from(set).sort();
  }, [timezone]);

  return (
    <div className="space-y-6">
      <div>
        <span className="mb-2 block text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          Timezone
        </span>
        <div className="rounded-lg bg-surface-2 px-1">
          <Select<string>
            value={timezone}
            onChange={(v) => onTimezone(v)}
            options={tzOptions.map((tz) => ({ value: tz, label: tz }))}
            placeholder="Select timezone"
            className="h-11 text-[14px]"
          />
        </div>
        <p className="mt-1.5 text-[12px] text-fg-subtle">
          Auto-detected from your browser. Change if needed.
        </p>
      </div>

      <div>
        <span className="mb-2 block text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          Start of week
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(["mon", "sun"] as const).map((d) => {
            const active = startOfWeek === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onStartOfWeek(d)}
                className={cn(
                  "relative h-12 rounded-lg text-sm font-medium",
                  "transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  active ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg",
                )}
                aria-pressed={active}
              >
                {d === "mon" ? "Monday" : "Sunday"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Step 3 — Confirm ───────────────── */

function StepConfirm({
  email, name, avatarUrl,
}: { email: string; name: string; avatarUrl?: string }) {
  return (
    <div className="rounded-2xl bg-surface-1 p-6">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 overflow-hidden rounded-2xl bg-surface-2">
          {avatarUrl && (
            <Image src={avatarUrl} alt="" width={56} height={56} unoptimized className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold text-fg">{name || "—"}</div>
          <div className="truncate text-[13px] text-fg-muted">{email}</div>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg bg-surface-2 p-3">
        <span className="mt-0.5 text-accent">
          <Sparkles size={16} strokeWidth={2} />
        </span>
        <p className="text-[13px] leading-relaxed text-fg-muted">
          Your assistant is ready. Tomorrow we&apos;ll greet you with your daily plan —
          tasks, habits, goals, and a quick capture inbox.
        </p>
      </div>
    </div>
  );
}

export function OnboardingLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="animate-spin text-fg-subtle" size={20} />
    </div>
  );
}
