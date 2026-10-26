"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Coffee, Brain, Settings2, Minus, Plus, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils/cn";

type Mode = "focus" | "break";

const STORAGE_KEY = "cairn:pomodoro:v1";
const LEGACY_STORAGE_KEY = "osama:pomodoro:v1";
const DEFAULTS = { focus: 25, break: 5 } as const;
const PRESETS = {
  focus: [15, 25, 45, 60],
  break: [5, 10, 15],
} as const;

type Settings = { focus: number; break: number };

function loadSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        window.localStorage.setItem(STORAGE_KEY, raw);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if (!raw) return { ...DEFAULTS };
    const v = JSON.parse(raw) as Partial<Settings>;
    return {
      focus: clamp(v.focus ?? DEFAULTS.focus, 1, 180),
      break: clamp(v.break ?? DEFAULTS.break, 1, 60),
    };
  } catch { return { ...DEFAULTS }; }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function Pomodoro() {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS });
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(DEFAULTS.focus * 60);
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted settings once on mount, then sync remaining if not running.
  useEffect(() => {
    const next = loadSettings();
    setSettings(next);
    setRemaining(next[mode] * 60);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist settings whenever they change.
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  // Tick.
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          const next: Mode = mode === "focus" ? "break" : "focus";
          setMode(next);
          chime();
          return settings[next] * 60;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode, settings]);

  function reset() {
    setRunning(false);
    setRemaining(settings[mode] * 60);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setRemaining(settings[next] * 60);
    setRunning(false);
  }

  function applySettings(next: Settings) {
    setSettings(next);
    setRunning(false);
    setRemaining(next[mode] * 60);
  }

  const total = settings[mode] * 60;
  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="rounded-2xl bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded-full bg-surface-2 p-1">
          <ModeChip active={mode === "focus"} onClick={() => switchMode("focus")} icon={<Brain size={13} strokeWidth={2} />}>
            Focus
          </ModeChip>
          <ModeChip active={mode === "break"} onClick={() => switchMode("break")} icon={<Coffee size={13} strokeWidth={2} />}>
            Break
          </ModeChip>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label="Customize timer"
            aria-pressed={editing}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg",
              editing && "bg-surface-2 text-fg",
            )}
          >
            <Settings2 size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={reset}
            className="grid h-8 w-8 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
            aria-label="Reset"
          >
            <RotateCcw size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {editing ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 space-y-4"
          >
            <DurationField
              label="Focus"
              value={settings.focus}
              presets={PRESETS.focus}
              min={1}
              max={180}
              onChange={(v) => applySettings({ ...settings, focus: v })}
            />
            <DurationField
              label="Break"
              value={settings.break}
              presets={PRESETS.break}
              min={1}
              max={60}
              onChange={(v) => applySettings({ ...settings, break: v })}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { applySettings({ ...DEFAULTS }); }}
                className="inline-flex h-8 items-center rounded-md bg-surface-2 px-2.5 text-[12px] font-medium text-fg-muted hover:bg-surface-3 hover:text-fg"
              >
                Reset to default
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-accent px-2.5 text-[12px] font-semibold text-accent-fg"
              >
                <Check size={12} strokeWidth={2.5} /> Done
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="timer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mt-6 flex items-center justify-center">
              <div className="relative grid h-44 w-44 place-items-center">
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface-2)" strokeWidth="6" />
                  <motion.circle
                    cx="50" cy="50" r="44"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray="100"
                    animate={{ strokeDashoffset: 100 - pct }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
                <div className="text-center">
                  <div className="font-mono text-[34px] font-semibold tracking-tight text-fg tabular-nums">
                    {mm}:{ss}
                  </div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
                    {mode === "focus" ? "Deep work" : "Recharge"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold",
                  "transition-transform duration-150 hover:scale-[1.02] active:scale-95",
                  "bg-accent text-accent-fg",
                )}
              >
                {running ? <Pause size={16} strokeWidth={2.5} /> : <Play size={16} strokeWidth={2.5} />}
                {running ? "Pause" : "Start"}
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] text-fg-subtle">
              {settings.focus} min focus · {settings.break} min break
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeChip({
  active, onClick, children, icon,
}: { active: boolean; onClick: () => void; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium",
        active ? "text-accent-fg" : "text-fg-muted hover:text-fg",
      )}
    >
      {active && (
        <motion.span
          layoutId="pom-mode-active"
          className="absolute inset-0 -z-10 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      {icon}
      {children}
    </button>
  );
}

function DurationField({
  label, value, presets, min, max, onChange,
}: {
  label: string;
  value: number;
  presets: readonly number[];
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  function bump(delta: number) { onChange(clamp(value + delta, min, max)); }
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">{label}</span>
        <span className="font-mono text-[11px] text-fg-muted">{min}–{max} min</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => bump(-5)}
          aria-label={`Decrease ${label}`}
          className="grid h-9 w-9 place-items-center rounded-md bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
        >
          <Minus size={13} strokeWidth={2.25} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(clamp(n, min, max));
          }}
          className="h-9 w-16 rounded-md bg-surface-2 text-center font-mono text-[14px] font-semibold text-fg outline-none focus:bg-surface-3"
          aria-label={`${label} minutes`}
        />
        <button
          type="button"
          onClick={() => bump(5)}
          aria-label={`Increase ${label}`}
          className="grid h-9 w-9 place-items-center rounded-md bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
        >
          <Plus size={13} strokeWidth={2.25} />
        </button>
        <span className="text-[12px] text-fg-subtle">min</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={value === p}
            className={cn(
              "h-7 rounded-full px-2.5 text-[11.5px] font-medium",
              value === p ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted hover:text-fg",
            )}
          >
            {p}m
          </button>
        ))}
      </div>
    </div>
  );
}

/** Subtle audio cue when a period ends. Silent if blocked. */
function chime() {
  if (typeof window === "undefined") return;
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 660;
    g.gain.value = 0.0001;
    const now = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.07, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    o.start();
    o.stop(now + 0.75);
    setTimeout(() => ctx.close().catch(() => undefined), 1200);
  } catch {}
}
