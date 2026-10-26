import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { PricingCards } from "@/components/marketing/pricing-cards";

export default async function Landing() {
  const session = await getSession();
  if (session?.onboarded) redirect("/today");

  return (
    <>
      <Hero />
      <Features />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <header className="mb-10 max-w-[52ch]">
          <h2 className="text-[32px] font-semibold tracking-[-0.01em] text-fg md:text-[40px]">
            Simple pricing.
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-fg-muted">
            Free forever for the essentials. Pro unlocks the assistant, sync, and review drafts.
          </p>
        </header>
        <PricingCards />
        <div className="mt-6 text-center">
          <Link href="/pricing" className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg">
            See full comparison <ArrowRight size={12} strokeWidth={2} />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-3xl bg-surface-1 px-8 py-14 text-center sm:px-16">
          <h2 className="text-[28px] font-semibold tracking-[-0.01em] text-fg md:text-[36px]">
            Your calmest week starts today.
          </h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-[15px] leading-relaxed text-fg-muted">
            Sign in with Google, GitHub, or Apple. No credit card. No friction.
          </p>
          <Link
            href="/signin"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-fg hover:brightness-110"
          >
            Get started — free
            <ArrowRight size={16} strokeWidth={2.25} />
          </Link>
        </div>
      </section>
    </>
  );
}
