"use client";

import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Topbar({
  greeting,
  date,
  onQuickAdd,
  onPlanMyDay,
}: {
  greeting: string;
  date: string;
  onQuickAdd: () => void;
  onPlanMyDay: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-6 pb-4 pt-6 md:px-10 md:pt-10">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-fg md:text-[30px]">
          {greeting}
        </h1>
        <p className="mt-1 text-[13px] text-fg-muted">{date}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          leadingIcon={<Sparkles size={16} strokeWidth={1.75} />}
          onClick={onPlanMyDay}
        >
          Plan
        </Button>
        <Button
          size="md"
          leadingIcon={<Plus size={16} strokeWidth={2} />}
          onClick={onQuickAdd}
        >
          New
          <kbd className="ml-1 rounded bg-black/15 px-1 py-0.5 font-mono text-[10px]">N</kbd>
        </Button>
      </div>
    </div>
  );
}
