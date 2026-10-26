"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";

export function PageHeader({
  title, subtitle, actions, icon: Icon,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="flex flex-col gap-4 px-6 pb-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6 md:px-10 md:pt-10">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-1 text-accent">
            <Icon size={18} strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
          <motion.h1
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-[24px] font-semibold tracking-tight text-fg sm:text-[26px] md:text-[30px]"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <p className="mt-1 text-[13px] text-fg-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
    </header>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 pb-24 sm:px-6 md:px-10 md:pb-10 ${className ?? ""}`}>{children}</div>;
}

export function Empty({
  icon: Icon, title, body, action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-2xl bg-surface-1 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-fg-muted">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-fg">{title}</h3>
      {body && <p className="mt-1 max-w-[36ch] text-[13px] text-fg-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
