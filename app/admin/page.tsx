import { Activity, Mail, Users, ToggleRight } from "lucide-react";
import { countUsers } from "@/lib/db/users";

export default async function AdminOverview() {
  const userCount = await countUsers();

  const CARDS = [
    { label: "Users", value: userCount > 0 ? String(userCount) : "—", icon: Users },
    { label: "Active today", value: "—", icon: Activity },
    { label: "Emails sent (7d)", value: "—", icon: Mail },
    { label: "Open flags", value: "0", icon: ToggleRight },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl bg-surface-1 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-fg-subtle">{c.label}</span>
                <span className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 text-fg-muted">
                  <Icon size={14} strokeWidth={1.75} />
                </span>
              </div>
              <div className="mt-3 text-[24px] font-semibold tracking-tight text-fg">{c.value}</div>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl bg-surface-1 p-6">
        <h2 className="text-[15px] font-semibold text-fg">Heads up</h2>
        <p className="mt-1 text-[13px] text-fg-muted">
          User list is live from MongoDB. Feature flags, deliverability, and the error log still need
          observability wiring. Gate access with{" "}
          <code className="rounded bg-surface-2 px-1 font-mono text-[12px]">ADMIN_EMAILS</code>.
        </p>
      </div>
    </div>
  );
}
