import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { getSession } from "@/lib/auth/session";
import { getUserByEmail } from "@/lib/db/users";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  // Trust the DB as source of truth so returning users skip the wizard.
  // Cookie sync must happen in a Route Handler (not during RSC render).
  const user = await getUserByEmail(session.email);
  if (user?.profile.onboarded) {
    if (!session.onboarded) redirect("/session/sync?next=/today");
    redirect("/today");
  }
  if (session.onboarded) redirect("/today");

  return (
    <div className="flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:px-16">
      <header className="flex items-center justify-between">
        <Logo size={28} withWordmark />
        <a
          href="/signout"
          className="text-[13px] font-medium text-fg-subtle hover:text-fg"
        >
          Sign out
        </a>
      </header>

      <main className="flex flex-1 items-center justify-center py-12">
        <OnboardingWizard
          initialEmail={session.email}
          initialName={session.name ?? user?.profile.name}
        />
      </main>

      <footer className="flex items-center justify-end">
        <ThemeSwitcher />
      </footer>
    </div>
  );
}
