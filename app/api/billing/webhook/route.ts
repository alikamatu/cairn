import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/billing/paystack";
import { buildActivatedPatch } from "@/lib/billing/subscription";
import { applyBillingProfile } from "@/lib/db/users";
import type { PlanInterval } from "@/lib/auth/session";
import { periodMs } from "@/lib/billing/plans";

type PaystackCustomer = { email?: string; customer_code?: string };
type PaystackData = {
  reference?: string;
  customer?: PaystackCustomer;
  metadata?: Record<string, unknown> | null;
  paid_at?: string;
  next_payment_date?: string;
  status?: string;
};

/**
 * Paystack webhook receiver.
 * Verifies HMAC-SHA512, then persists plan changes on the users collection
 * so renewals / disables survive beyond the browser session cookie.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  type Event = { event: string; data?: PaystackData };
  let evt: Event;
  try {
    evt = JSON.parse(raw) as Event;
  } catch {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }

  const email = evt.data?.customer?.email?.toLowerCase();
  const customerCode = evt.data?.customer?.customer_code ?? null;

  try {
    switch (evt.event) {
      case "charge.success":
      case "subscription.create": {
        if (!email) break;
        const interval = ((evt.data?.metadata?.interval as PlanInterval | undefined) ?? "monthly") as PlanInterval;
        const patch = buildActivatedPatch(interval, customerCode);
        // Prefer Paystack's next_payment_date when present.
        if (evt.data?.next_payment_date) {
          const ts = Date.parse(evt.data.next_payment_date);
          if (!Number.isNaN(ts)) patch.planRenewsAt = ts;
        } else if (evt.data?.paid_at) {
          const paid = Date.parse(evt.data.paid_at);
          if (!Number.isNaN(paid)) patch.planRenewsAt = paid + periodMs(interval);
        }
        await applyBillingProfile(email, patch);
        break;
      }
      case "subscription.disable":
      case "invoice.payment_failed": {
        if (!email) break;
        await applyBillingProfile(email, {
          plan: "free",
          planInterval: null,
          planRenewsAt: null,
          paystackCustomerCode: customerCode,
        });
        break;
      }
      case "invoice.update": {
        if (!email) break;
        if (evt.data?.next_payment_date) {
          const ts = Date.parse(evt.data.next_payment_date);
          if (!Number.isNaN(ts)) {
            await applyBillingProfile(email, {
              plan: "pro",
              planRenewsAt: ts,
              paystackCustomerCode: customerCode,
            });
          }
        }
        break;
      }
      default:
        console.log("[paystack-webhook] unhandled", evt.event);
    }
  } catch (err) {
    console.error("[paystack-webhook] persist failed", (err as Error).message);
    return NextResponse.json({ error: "persist_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
