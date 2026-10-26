import { listUsers } from "@/lib/db/users";

export default async function AdminUsersPage() {
  const users = await listUsers(200);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-fg">Users</h1>
        <p className="mt-1 text-[13px] text-fg-muted">
          {users.length === 0
            ? "No users yet (or MongoDB is unreachable)."
            : `${users.length} most recently active.`}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface-1">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border/60 text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Onboarded</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-3 font-medium text-fg">{u.email}</td>
                <td className="px-4 py-3 text-fg-muted">{u.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      u.plan === "pro"
                        ? "rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent"
                        : "rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-muted"
                    }
                  >
                    {u.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-fg-muted">{u.onboarded ? "yes" : "no"}</td>
                <td className="px-4 py-3 text-fg-subtle">
                  {u.updatedAt ? new Date(u.updatedAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-fg-muted">
                  Nothing to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
