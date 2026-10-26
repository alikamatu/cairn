"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Archive, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { useLiveTasks, useLiveNotes } from "@/lib/store/selectors";
import { PageBody } from "@/components/ui/page";
import { useConfirm } from "@/components/ui/confirm";
import { TaskListView } from "@/components/tasks/task-list-view";
import { cn } from "@/lib/utils/cn";

type Tab = "overview" | "tasks" | "notes" | "files";
const TABS: Tab[] = ["overview", "tasks", "notes", "files"];

export default function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const project = useStore((s) => s.projects.find((p) => p.id === id));
  const allTasks = useLiveTasks();
  const notes = useLiveNotes();
  const update = useStore((s) => s.updateProject);
  const remove = useStore((s) => s.deleteProject);
  const [tab, setTab] = useState<Tab>("overview");

  async function onDelete() {
    const ok = await confirm({
      title: "Delete project?",
      description: "Tasks in this project become unassigned. They aren't deleted.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) { remove(project!.id); router.push("/projects"); }
  }

  const tasks = useMemo(() => allTasks.filter((t) => t.projectId === id), [allTasks, id]);

  if (!project) {
    return (
      <PageBody className="pt-10">
        <p className="text-fg-muted">Project not found.</p>
        <Link href="/projects" className="mt-3 inline-flex items-center gap-1 text-[13px] text-accent"><ArrowLeft size={14} /> All projects</Link>
      </PageBody>
    );
  }

  const open = tasks.filter((t) => t.status !== "done").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = (open + done) > 0 ? Math.round((done / (open + done)) * 100) : 0;
  const linkedNotes = notes.filter((n) => tasks.some((t) => n.taskIds.includes(t.id)));

  return (
    <>
      <div className="px-6 pt-6 md:px-10 md:pt-10">
        <Link href="/projects" className="inline-flex items-center gap-1 text-[12.5px] text-fg-subtle hover:text-fg">
          <ArrowLeft size={13} strokeWidth={2} /> All projects
        </Link>
      </div>
      <PageBody>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <input
              value={project.name}
              onChange={(e) => update(project.id, { name: e.target.value })}
              className="w-full bg-transparent text-[28px] font-semibold tracking-tight text-fg outline-none"
            />
            <textarea
              value={project.description ?? ""}
              onChange={(e) => update(project.id, { description: e.target.value })}
              placeholder="What's this project about?"
              rows={2}
              className="mt-1 block w-full resize-none bg-transparent text-[14px] leading-relaxed text-fg-muted outline-none placeholder:text-fg-subtle"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => update(project.id, { archived: !project.archived })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-1 px-3 text-[12.5px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <Archive size={13} strokeWidth={2} />
              {project.archived ? "Unarchive" : "Archive"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="grid h-9 w-9 place-items-center rounded-lg bg-surface-1 text-fg-subtle hover:bg-surface-2 hover:text-[color:var(--danger)]"
              aria-label="Delete project"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Open"       value={open} />
          <Stat label="Done"        value={done} />
          <Stat label="Completion"  value={`${pct}%`} />
        </div>

        <nav className="mt-8 inline-flex gap-1 rounded-full bg-surface-1 p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              role="tab"
              aria-selected={tab === t}
              className={cn(
                "relative inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium capitalize",
                tab === t ? "text-accent-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {tab === t && (
                <motion.span layoutId="proj-tab-active" className="absolute inset-0 -z-10 rounded-full bg-accent" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
              )}
              {t}
            </button>
          ))}
        </nav>

        <div className="mt-5">
          {tab === "overview" && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Panel title="Recent tasks">
                <TaskListView tasks={tasks.slice(0, 6)} />
              </Panel>
              <Panel title="Linked notes">
                {linkedNotes.length === 0 ? (
                  <p className="text-[13px] text-fg-muted">No notes linked yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {linkedNotes.slice(0, 6).map((n) => (
                      <li key={n.id}>
                        <Link href={`/notes/${n.id}`} className="block truncate rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-fg hover:bg-surface-3">
                          {n.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}
          {tab === "tasks" && <TaskListView tasks={tasks} />}
          {tab === "notes" && (
            linkedNotes.length === 0
              ? <p className="text-[13px] text-fg-muted">No notes linked to this project&apos;s tasks.</p>
              : <ul className="space-y-1.5">
                  {linkedNotes.map((n) => (
                    <li key={n.id}><Link href={`/notes/${n.id}`} className="block rounded-lg bg-surface-1 px-3 py-2 text-[13px] text-fg hover:bg-surface-2">{n.title}</Link></li>
                  ))}
                </ul>
          )}
          {tab === "files" && (
            <p className="text-[13px] text-fg-muted">File attachments arrive with Cloudinary uploads — endpoint is ready.</p>
          )}
        </div>
      </PageBody>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-surface-1 p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight text-fg">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-1 p-4">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">{title}</h3>
      {children}
    </div>
  );
}
