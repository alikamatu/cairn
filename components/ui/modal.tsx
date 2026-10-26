"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Modal({
  open, onOpenChange, title, description, children, size = "md", className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onOpenChange(false); return; }
      if (e.key === "Tab") {
        const root = ref.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);

    const t = setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      if (root.contains(document.activeElement)) return;
      const focusable =
        root.querySelector<HTMLElement>(
          'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [contenteditable="true"]',
        ) ??
        root.querySelector<HTMLElement>(
          'button:not([disabled]):not([aria-label="Close"]), [tabindex="0"]:not([disabled])',
        );
      focusable?.focus();
    }, 30);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, onOpenChange]);

  const widths = {
    sm: "sm:max-w-[420px]",
    md: "sm:max-w-[540px]",
    lg: "sm:max-w-[720px]",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 bg-black/45"
          />
          <motion.div
            ref={ref}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "relative z-10 flex w-full flex-col overflow-hidden rounded-t-2xl bg-surface-1",
              "max-h-[min(92dvh,920px)] pb-[env(safe-area-inset-bottom)]",
              widths[size],
              className,
            )}
          >
            <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden="true">
              <span className="h-1 w-9 rounded-full bg-fg-subtle/35" />
            </div>
            {(title || description) && (
              <header className="flex items-start gap-3 px-5 pt-2">
                <div className="min-w-0 flex-1">
                  {title && <h2 className="text-[17px] font-semibold tracking-tight text-fg">{title}</h2>}
                  {description && <p className="mt-1 text-[13px] text-fg-muted">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label="Close"
                  tabIndex={-1}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <X size={15} strokeWidth={2} />
                </button>
              </header>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
