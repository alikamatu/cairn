"use client";

import { use, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Sparkles, Trash2, Square, MessagesSquare } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useStore } from "@/lib/store";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils/cn";
import { buildGoalCtx, buildHabitCtx, buildTaskCtx, streamPost } from "@/lib/ai/client";
import { useConfirm } from "@/components/ui/confirm";
import { ChatBackground } from "@/components/assistant/chat-background";

const SLASH_HINTS = ["/plan", "/review", "/clear-inbox"];

const EASE = [0.22, 1, 0.36, 1] as const;

const messageVariants: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.985 },
  animate: { opacity: 1, y: 0,  scale: 1 },
  exit:    { opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.18 } },
};

export default function ChatThread({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const router = useRouter();
  const confirm = useConfirm();

  const convo = useStore((s) => s.conversations.find((c) => c.id === threadId));
  const conversations = useStore((s) => s.conversations);
  const append = useStore((s) => s.appendMessage);
  const rename = useStore((s) => s.renameConversation);
  const remove = useStore((s) => s.deleteConversation);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingText, setPendingText] = useState("");
  const [showJump, setShowJump] = useState(false);

  const abortRef     = useRef<(() => void) | null>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const endRef       = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  // Smooth auto-scroll the inner messages container only (not the page).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (isNearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [convo?.messages.length, pendingText]);

  useEffect(() => () => { abortRef.current?.(); }, []);

  // Auto-grow textarea up to 6 rows.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 24 * 6 + 16; // ~6 rows
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [input]);

  // Show a "jump to latest" pill when the user has scrolled up.
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 240);
  }
  function jumpToEnd() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  if (!convo) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] md:h-[100dvh] flex-col px-4 pt-10 md:px-10">
        <Link href="/assistant" className="inline-flex items-center gap-1 text-[13px] text-accent">
          <ArrowLeft size={14} /> Conversations
        </Link>
        <p className="mt-4 text-fg-muted">Conversation not found.</p>
      </div>
    );
  }

  function buildContext() {
    const s = useStore.getState();
    const projById = new Map(s.projects.map((p) => [p.id, p]));
    return {
      tasks:  s.tasks .filter((t) => !t.deletedAt).slice(0, 60).map((t) => buildTaskCtx(t, t.projectId ? projById.get(t.projectId)?.name : null)),
      habits: s.habits.filter((h) => !h.deletedAt).map(buildHabitCtx),
      goals:  s.goals .filter((g) => !g.deletedAt).slice(0, 20).map(buildGoalCtx),
    };
  }

  function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    append(convo!.id, { role: "user", content: text });
    if (convo!.messages.length === 0 && convo!.title === "New conversation") {
      rename(convo!.id, text.length > 36 ? `${text.slice(0, 36)}…` : text);
    }
    setPendingText("");
    setStreaming(true);

    const baseMessages = [
      ...convo!.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: text },
    ];

    abortRef.current = streamPost({
      url: "/api/ai/chat",
      body: { messages: baseMessages, context: buildContext() },
      onChunk: (_d, full) => setPendingText(full),
      onDone:  (full) => {
        if (full.trim()) append(convo!.id, { role: "assistant", content: full });
        setPendingText("");
        setStreaming(false);
        abortRef.current = null;
      },
      onError: (msg) => {
        append(convo!.id, { role: "assistant", content: friendlyAiError(msg) });
        setPendingText("");
        setStreaming(false);
        abortRef.current = null;
      },
    });
  }

  function stop() {
    abortRef.current?.();
    if (pendingText.trim()) append(convo!.id, { role: "assistant", content: pendingText });
    setPendingText("");
    setStreaming(false);
    abortRef.current = null;
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this conversation?",
      description: "This can't be undone. The chat history will be removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) { remove(convo!.id); router.push("/assistant"); }
  }

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] md:h-[100dvh] flex-col overflow-hidden bg-bg">
      {/* Header — fixed */}
      <motion.header
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.32, ease: EASE }}
        className="relative z-20 flex shrink-0 items-center justify-between px-4 pb-3 pt-4 md:px-10 md:pt-6"
      >
        <Link
          href="/assistant"
          className="group inline-flex items-center gap-1 text-[12.5px] text-fg-subtle hover:text-fg"
        >
          <motion.span whileHover={{ x: -2 }} transition={{ duration: 0.16, ease: EASE }} className="inline-flex">
            <ArrowLeft size={13} strokeWidth={2} />
          </motion.span>
          <span>Conversations</span>
        </Link>
        <motion.button
          type="button"
          onClick={onDelete}
          aria-label="Delete conversation"
          whileTap={{ scale: 0.92 }}
          className="grid h-8 w-8 place-items-center rounded-md text-fg-subtle hover:bg-surface-1 hover:text-[color:var(--danger)]"
        >
          <Trash2 size={14} strokeWidth={2} />
        </motion.button>
      </motion.header>

      {/* Body: thread list + chat column */}
      <div className="relative flex min-h-0 flex-1 gap-6 px-4 pb-3 md:px-10">
        {/* Thread list — independently scrollable on desktop */}
        <motion.aside
          initial={{ x: -12, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.36, ease: EASE, delay: 0.05 }}
          className="hidden w-[220px] shrink-0 lg:flex lg:flex-col"
        >
          <h4 className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">Threads</h4>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
            {conversations.map((c, i) => {
              const active = c.id === convo.id;
              return (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, ease: EASE, delay: 0.08 + Math.min(i, 12) * 0.02 }}
                >
                  <Link
                    href={`/assistant/${c.id}`}
                    className={cn(
                      "relative block truncate rounded-md px-2 py-1.5 text-[12.5px]",
                      active ? "text-fg" : "text-fg-muted hover:bg-surface-1 hover:text-fg",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="thread-active"
                        className="absolute inset-0 -z-10 rounded-md bg-surface-1"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    {c.title}
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </motion.aside>

        {/* Chat column */}
        <motion.main
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.06 }}
          className="relative flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface-1"
        >
          {/* Decorative background sits BEHIND messages */}
          <ChatBackground />

          {/* Title row inside the chat surface (so it scrolls with the surface, not the messages) */}
          <div className="relative z-10 flex items-center gap-3 px-4 pt-4 sm:px-5 md:px-6 md:pt-5">
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              transition={{ duration: 0.36, ease: EASE }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg"
              aria-hidden="true"
            >
              <Sparkles size={15} strokeWidth={2} />
            </motion.span>
            <input
              value={convo.title}
              onChange={(e) => rename(convo.id, e.target.value)}
              aria-label="Conversation title"
              className="min-w-0 flex-1 bg-transparent text-[18px] font-semibold tracking-tight text-fg outline-none placeholder:text-fg-subtle md:text-[20px]"
            />
            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-fg-subtle sm:inline-flex">
              <MessagesSquare size={11} strokeWidth={2} />
              {convo.messages.length}
            </span>
          </div>

          {/* The ONE scrollable region on this page. */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 md:px-6"
          >
            {convo.messages.length === 0 && !pendingText && <EmptyState />}

            <ul className="space-y-4">
              <AnimatePresence initial={false}>
                {convo.messages.map((m, i) => (
                  <motion.li
                    key={m.id}
                    layout="position"
                    variants={messageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.34, ease: EASE, delay: Math.min(i, 8) * 0.015 }}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <Bubble role={m.role}>
                      {m.role === "assistant"
                        ? <Markdown source={m.content} />
                        : <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.content}</p>}
                    </Bubble>
                  </motion.li>
                ))}

                {streaming && (
                  <motion.li
                    key="streaming"
                    variants={messageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.24, ease: EASE }}
                    className="flex justify-start"
                  >
                    <Bubble role="assistant">
                      {pendingText ? <Markdown source={pendingText} /> : <Typing />}
                    </Bubble>
                  </motion.li>
                )}
              </AnimatePresence>
            </ul>

            <div ref={endRef} className="h-1" />
          </div>

          {/* "Jump to latest" pill */}
          <AnimatePresence>
            {showJump && (
              <motion.button
                key="jump"
                type="button"
                onClick={jumpToEnd}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="absolute bottom-[88px] left-1/2 z-20 -translate-x-1/2 rounded-full bg-accent px-3 py-1.5 text-[11.5px] font-semibold text-accent-fg hover:brightness-110"
              >
                Jump to latest ↓
              </motion.button>
            )}
          </AnimatePresence>

          {/* Composer — pinned to the chat surface bottom */}
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.12 }}
            className="relative z-10 flex items-end gap-2 bg-surface-1 p-3 sm:p-4 md:p-5"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder='Ask Cairn — Enter to send, Shift+Enter for newline. Try a slash command like "/plan".'
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none rounded-xl bg-surface-2 px-3 py-2.5 text-[14px] text-fg outline-none placeholder:text-fg-subtle disabled:opacity-60"
            />

            <AnimatePresence initial={false} mode="popLayout">
              {streaming ? (
                <motion.button
                  key="stop"
                  type="button"
                  onClick={stop}
                  aria-label="Stop"
                  initial={{ opacity: 0, scale: 0.85, rotate: -20 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.85, rotate: 20 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
                >
                  <Square size={14} strokeWidth={2.5} />
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  type="button"
                  onClick={send}
                  disabled={!input.trim()}
                  aria-label="Send"
                  initial={{ opacity: 0, scale: 0.85, rotate: 20 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.85, rotate: -20 }}
                  whileHover={input.trim() ? { scale: 1.05 } : undefined}
                  whileTap={input.trim() ? { scale: 0.92 } : undefined}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg disabled:opacity-50"
                >
                  <Send size={16} strokeWidth={2} />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.main>
      </div>
    </div>
  );
}

/* ───────────────── pieces ───────────────── */

function Bubble({ role, children }: { role: "user" | "assistant" | "system"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <motion.div
      whileHover={{ scale: 1.0025 }}
      transition={{ duration: 0.14, ease: EASE }}
      className={cn(
        "max-w-[88%] rounded-2xl px-4 py-2.5 md:max-w-[78%]",
        isUser ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg",
      )}
    >
      {children}
    </motion.div>
  );
}

function EmptyState() {
  const items: Array<{ cmd: string; copy: string }> = [
    { cmd: "/plan",         copy: "Draft a schedule for today from open tasks" },
    { cmd: "/review",       copy: "Summarize what moved this week" },
    { cmd: "/clear-inbox",  copy: "Route stray captures into projects" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="grid place-items-center py-12 text-center"
    >
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1, rotate: [0, -8, 0] }}
        transition={{
          scale:   { duration: 0.5, ease: EASE },
          opacity: { duration: 0.5, ease: EASE },
          rotate:  { duration: 6, repeat: Infinity, ease: "easeInOut" },
        }}
        className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-accent"
        aria-hidden="true"
      >
        <Sparkles size={20} strokeWidth={1.75} />
      </motion.span>

      <motion.h3
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: EASE, delay: 0.1 }}
        className="mt-4 text-[16px] font-semibold tracking-tight text-fg"
      >
        How can I help?
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: EASE, delay: 0.15 }}
        className="mt-1 max-w-[48ch] text-[13px] text-fg-muted"
      >
        I&apos;ve got your tasks, habits, and goals already loaded. Ask for a plan, a review, or just type.
      </motion.p>

      <div className="mt-6 grid w-full max-w-[480px] grid-cols-1 gap-1.5">
        {SLASH_HINTS.map((cmd, i) => {
          const item = items.find((x) => x.cmd === cmd);
          return (
            <motion.div
              key={cmd}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE, delay: 0.22 + i * 0.06 }}
              className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-left"
            >
              <kbd className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-fg">{cmd}</kbd>
              <span className="text-[12.5px] text-fg-muted">{item?.copy}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-1" aria-label="Cairn is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-fg-subtle"
          animate={{ y: [0, -2, 0], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.13, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function friendlyAiError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("credit balance") || lower.includes("credit_balance") || lower.includes("quota") || lower.includes("resource_exhausted")) {
    return "**Gemini quota or credits exhausted.** Check your quota at [ai.google.dev](https://ai.google.dev) or [console.cloud.google.com](https://console.cloud.google.com), then try again.";
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return "**Hit a rate limit.** Try again in a minute.";
  }
  if (lower.includes("401") || lower.includes("invalid x-api-key") || lower.includes("api_key_invalid") || lower.includes("permission_denied")) {
    return "**AI key was rejected.** Check `GEMINI_API_KEY` and try again.";
  }
  return `**Assistant error.** ${raw}`;
}
