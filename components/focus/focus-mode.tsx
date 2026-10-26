"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Brain, Check, ChevronDown, Cloud, CloudOff, Coffee, Pause, Play, RotateCcw, X, Settings2, Minus, Plus,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils/cn";
import { useRainSound } from "@/hooks/use-rain-sound";
import { FocusWaves } from "@/components/focus/focus-waves";
import type { Task } from "@/types/entities";

// ── Settings (shared storage key with the Pomodoro widget) ───────────────

const STORAGE_KEY = "cairn:pomodoro:v1";
const LEGACY_STORAGE_KEY = "osama:pomodoro:v1";
type Mode = "focus" | "break";
const DEFAULTS = { focus: 25, break: 5 } as const;
const PRESETS = {
  focus: [15, 25, 45, 60],
  break: [5, 10, 15],
} as const;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function loadSettings(): { focus: number; break: number } {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if (!raw) return { ...DEFAULTS };
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      focus: clamp(Number(v.focus) || DEFAULTS.focus, 1, 180),
      break: clamp(Number(v.break) || DEFAULTS.break, 1, 60),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

// ── Audio ─────────────────────────────────────────────────────────────────

type AC = typeof AudioContext;

function getAC(): AC | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: AC }).webkitAudioContext ??
    null
  );
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  dur: number,
  vol = 0.09,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function playStartSound() {
  try {
    const AC = getAC();
    if (!AC) return;
    const ctx = new AC();
    tone(ctx, 440, 0,    0.20, 0.10);
    tone(ctx, 554, 0.14, 0.24, 0.10);
    setTimeout(() => ctx.close().catch(() => undefined), 800);
  } catch {}
}

function playEndSound() {
  try {
    const AC = getAC();
    if (!AC) return;
    const ctx = new AC();
    tone(ctx, 660,  0,    0.55, 0.09);
    tone(ctx, 880,  0.28, 0.55, 0.08);
    tone(ctx, 1320, 0.56, 0.70, 0.06);
    setTimeout(() => ctx.close().catch(() => undefined), 1900);
  } catch {}
}

// ── SVG ring constants ────────────────────────────────────────────────────

const SVG_SIZE = 280;
const CX = 140;
const CY = 140;
const R  = 118;
const CIRC = 2 * Math.PI * R; // ≈ 741.4

const PRIORITY_DOT = {
  low:  "bg-fg-subtle",
  med:  "bg-warning",
  high: "bg-danger",
} as const;

// ── SVG Ring component ────────────────────────────────────────────────────

function TimerRing({
  pct,
  running,
  mode,
  mm,
  ss,
}: {
  pct: number;
  running: boolean;
  mode: Mode;
  mm: string;
  ss: string;
}) {
  const dashOffset = CIRC * (1 - pct / 100);
  // tip-dot position (SVG coords, 0° at top → start at -π/2)
  const angle = -Math.PI / 2 + (2 * Math.PI * pct) / 100;
  const dotX  = CX + R * Math.cos(angle);
  const dotY  = CY + R * Math.sin(angle);

  return (
    <motion.div
      className="relative"
      animate={running ? { scale: [1, 1.014, 1] } : { scale: 1 }}
      transition={
        running
          ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <svg
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        aria-hidden="true"
        className="overflow-visible"
      >
        <defs>
          {/* Glow for the progress arc */}
          <filter id="fm-arc-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Stronger glow for the tip dot */}
          <filter id="fm-dot-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 60 tick marks (clock-face style), rotated so 0 = top */}
        <g transform={`rotate(-90 ${CX} ${CY})`}>
          {Array.from({ length: 60 }, (_, i) => {
            const a = (i / 60) * 2 * Math.PI;
            const major = i % 5 === 0;
            const r1 = R - (major ? 14 : 8);
            const r2 = R + 4;
            return (
              <line
                key={i}
                x1={CX + r1 * Math.cos(a)} y1={CY + r1 * Math.sin(a)}
                x2={CX + r2 * Math.cos(a)} y2={CY + r2 * Math.sin(a)}
                stroke="var(--surface-2)"
                strokeWidth={major ? 2.5 : 1.2}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* Track ring */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke="var(--surface-1)"
          strokeWidth={10}
        />

        {/* Inner decoration ring */}
        <circle
          cx={CX} cy={CY} r={R - 18}
          fill="none"
          stroke="var(--surface-1)"
          strokeWidth={1}
          strokeDasharray="3 8"
        />

        {/* Progress arc */}
        <motion.circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          transform={`rotate(-90 ${CX} ${CY})`}
          filter="url(#fm-arc-glow)"
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Animated tip dot at the leading edge of the arc */}
        <AnimatePresence>
          {pct > 0.5 && (
            <motion.circle
              key="tip"
              fill="var(--accent)"
              filter="url(#fm-dot-glow)"
              initial={{ r: 0 }}
              exit={{ r: 0 }}
              animate={{
                cx: dotX,
                cy: dotY,
                r: running ? [6, 8.5, 6] : 6.5,
              }}
              transition={{
                cx: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
                cy: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
                r: running
                  ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.35 },
              }}
            />
          )}
        </AnimatePresence>
      </svg>

      {/* Center content (mode label, digits, percentage) */}
      <div className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center">
        <span className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-fg-subtle">
          {mode === "focus" ? "Deep work" : "Recharge"}
        </span>

        <div className="flex items-baseline font-mono leading-none tracking-tighter tabular-nums text-fg">
          <span className="text-[72px] font-bold">{mm}</span>
          <motion.span
            className="mx-0.5 mb-2 text-[60px] font-bold"
            animate={running ? { opacity: [1, 0.15, 1] } : { opacity: 1 }}
            transition={running ? { duration: 1, repeat: Infinity } : {}}
          >
            :
          </motion.span>
          <span className="text-[72px] font-bold">{ss}</span>
        </div>

        <span className="mt-2 font-mono text-[13px] tabular-nums text-fg-subtle">
          {Math.round(pct)}%
        </span>
      </div>
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────

export function FocusMode({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tasks      = useStore((s) => s.tasks);
  const toggleTask = useStore((s) => s.toggleTask);

  const openTasks = useMemo(
    () => tasks.filter((t) => !t.deletedAt && t.status !== "done"),
    [tasks],
  );

  const [settings, setSettings] = useState<{ focus: number; break: number }>({ ...DEFAULTS });
  const [mode, setMode]         = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(DEFAULTS.focus * 60);
  const [running, setRunning]   = useState(false);
  const [editing, setEditing]   = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pickerRef   = useRef<HTMLDivElement>(null);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? null,
    [tasks, selectedId],
  );

  // Load shared settings once on mount
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setRemaining(s.focus * 60);
  }, []);

  // Persist settings whenever they change.
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  // Auto-select first open task when first opened
  useEffect(() => {
    if (open && selectedId === null && openTasks.length > 0) {
      setSelectedId(openTasks[0].id);
    }
  }, [open, selectedId, openTasks]);

  // Ambient rain sound — synthesised via WebAudio.
  const rain = useRainSound();

  // Pause timer + rain when overlay hides.
  useEffect(() => {
    if (!open) {
      setRunning(false);
      rain.stop();
    }
  }, [open, rain]);

  // Timer tick
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          playEndSound();
          const next: Mode = mode === "focus" ? "break" : "focus";
          setMode(next);
          return settings[next] * 60;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode, settings]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const handleToggleRunning = useCallback(() => {
    setRunning((r) => {
      if (!r) playStartSound();
      return !r;
    });
  }, []);

  function reset() {
    setRunning(false);
    setRemaining(settings[mode] * 60);
  }

  function switchMode(next: Mode) {
    setRunning(false);
    setMode(next);
    setRemaining(settings[next] * 60);
  }

  function applySettings(next: { focus: number; break: number }) {
    setSettings(next);
    setRunning(false);
    setRemaining(next[mode] * 60);
  }

  function markTaskDone() {
    if (!selectedId) return;
    toggleTask(selectedId);
    const next = openTasks.find((t) => t.id !== selectedId);
    setSelectedId(next?.id ?? null);
  }

  const total   = settings[mode] * 60;
  const elapsed = total - remaining;
  const pct     = total > 0 ? (elapsed / total) * 100 : 0;
  const mm      = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss      = String(remaining % 60).padStart(2, "0");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Focus mode"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-bg"
        >
          {/* Animated SVG waves at the bottom — calm visual ambience */}
          <FocusWaves />

          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between px-6 py-4">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-fg-muted">
              <Brain size={15} strokeWidth={1.75} className="text-accent" />
              Focus Mode
            </span>
            <div className="flex items-center gap-1">
              {rain.supported && (
                <motion.button
                  type="button"
                  onClick={rain.toggle}
                  aria-label={rain.playing ? "Stop rain ambience" : "Play rain ambience"}
                  aria-pressed={rain.playing}
                  whileTap={{ scale: 0.92 }}
                  className={cn(
                    "relative grid h-9 w-9 place-items-center rounded-md transition-colors",
                    rain.playing
                      ? "bg-accent/15 text-accent"
                      : "text-fg-subtle hover:bg-surface-1 hover:text-fg",
                  )}
                  title={rain.playing ? "Rain on" : "Rain off"}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {rain.playing ? (
                      <motion.span
                        key="on"
                        initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.6, rotate: 8 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <Cloud size={16} strokeWidth={2} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="off"
                        initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.6, rotate: 8 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <CloudOff size={16} strokeWidth={2} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {rain.playing && (
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-md"
                      animate={{ boxShadow: ["0 0 0 0 var(--accent)", "0 0 0 4px transparent"] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                </motion.button>
              )}
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-label="Customize timer"
                aria-pressed={editing}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-1 hover:text-fg",
                  editing && "bg-surface-1 text-fg",
                )}
              >
                <Settings2 size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Exit focus mode"
                className="grid h-9 w-9 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-1 hover:text-fg"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-10">

            {/* Mode chip switcher */}
            <div className="flex items-center gap-1 rounded-full bg-surface-1 p-1">
              {(["focus", "break"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={cn(
                    "relative flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors",
                    mode === m ? "text-accent-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {mode === m && (
                    <motion.span
                      layoutId="fm-mode-chip"
                      className="absolute inset-0 -z-10 rounded-full bg-accent"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {m === "focus"
                    ? <Brain size={12} strokeWidth={2} />
                    : <Coffee size={12} strokeWidth={2} />}
                  {m === "focus" ? "Focus" : "Break"}
                </button>
              ))}
            </div>

            {/* SVG timer ring or Editor */}
            <AnimatePresence initial={false} mode="wait">
              {editing ? (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-6 rounded-2xl bg-surface-1 p-6 w-[280px]"
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
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { applySettings({ ...DEFAULTS }); }}
                      className="inline-flex h-8 items-center rounded-md bg-surface-2 px-2.5 text-[12px] font-medium text-fg-muted hover:bg-surface-3 hover:text-fg"
                    >
                      Reset
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
                  <TimerRing pct={pct} running={running} mode={mode} mm={mm} ss={ss} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Task picker */}
            <div ref={pickerRef} className="relative w-full max-w-xs">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left",
                  "bg-surface-1 transition-colors hover:bg-surface-2",
                  pickerOpen && "bg-surface-2",
                )}
              >
                {selectedTask ? (
                  <>
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[selectedTask.priority])} />
                    <span className="flex-1 truncate text-[14px] font-medium text-fg">
                      {selectedTask.title}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-surface-3" />
                    <span className="flex-1 text-[14px] text-fg-subtle">No task selected</span>
                  </>
                )}
                <motion.span
                  animate={{ rotate: pickerOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0"
                >
                  <ChevronDown size={15} strokeWidth={2} className="text-fg-subtle" />
                </motion.span>
              </button>

              <AnimatePresence>
                {pickerOpen && (
                  <motion.ul
                    role="listbox"
                    aria-label="Select task to focus on"
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute bottom-full left-0 right-0 mb-2 max-h-60 overflow-y-auto rounded-xl bg-surface-2 p-1 shadow-xl"
                  >
                    <li>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedId === null}
                        onClick={() => { setSelectedId(null); setPickerOpen(false); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
                      >
                        <span className="h-2 w-2 rounded-full bg-surface-3" />
                        <span className="flex-1">No specific task</span>
                        {selectedId === null && (
                          <Check size={13} strokeWidth={2.5} className="text-accent" />
                        )}
                      </button>
                    </li>
                    {openTasks.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedId === t.id}
                          onClick={() => { setSelectedId(t.id); setPickerOpen(false); }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] transition-colors hover:bg-surface-3"
                        >
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[t.priority])} />
                          <span className="flex-1 truncate text-fg">{t.title}</span>
                          {selectedId === t.id && (
                            <Check size={13} strokeWidth={2.5} className="shrink-0 text-accent" />
                          )}
                        </button>
                      </li>
                    ))}
                    {openTasks.length === 0 && (
                      <li className="px-3 py-2.5 text-[13px] text-fg-subtle">No open tasks</li>
                    )}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Reset */}
              <button
                type="button"
                onClick={reset}
                aria-label="Reset timer"
                className="grid h-11 w-11 place-items-center rounded-xl bg-surface-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <RotateCcw size={17} strokeWidth={1.75} />
              </button>

              {/* Play / Pause */}
              <motion.button
                type="button"
                onClick={handleToggleRunning}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex h-14 min-w-[148px] items-center justify-center gap-2.5 rounded-2xl bg-accent px-8 text-[15px] font-semibold text-accent-fg shadow-lg"
              >
                {running ? (
                  <><Pause size={18} strokeWidth={2.5} /> Pause</>
                ) : (
                  <><Play  size={18} strokeWidth={2.5} /> {elapsed > 0 ? "Resume" : "Start"}</>
                )}
              </motion.button>

              {/* Mark done / spacer */}
              {selectedTask ? (
                <motion.button
                  type="button"
                  onClick={markTaskDone}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  aria-label="Mark task done"
                  className="grid h-11 w-11 place-items-center rounded-xl bg-surface-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-accent"
                >
                  <Check size={18} strokeWidth={2.5} />
                </motion.button>
              ) : (
                <div className="h-11 w-11" aria-hidden="true" />
              )}
            </div>

            {/* Footer hint */}
            <p className="text-center text-[12px] text-fg-subtle">
              {settings.focus}m focus · {settings.break}m break
              {" · "}
              <kbd className="rounded bg-surface-1 px-1.5 font-mono text-[11px]">Esc</kbd> to exit
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
