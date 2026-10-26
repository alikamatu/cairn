"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { resend, FROM_EMAIL } from "@/lib/mail/resend";
import { magicLinkEmail } from "@/lib/mail/templates/magic-link";
import { signMagicToken, MAGIC_TOKEN_TTL_MINUTES } from "@/lib/auth/magic-token";
import { rateLimit } from "@/lib/rate-limit";

const InputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  name: z.string().trim().max(120).optional(),
  mode: z.enum(["signin", "signup"]),
});

export type SendMagicLinkResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

export async function sendMagicLink(input: unknown): Promise<SendMagicLinkResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { email, mode } = parsed.data;

  const limited = await rateLimit(`magic-send:${email}`, 5, 15 * 60_000);
  if (!limited.allowed) {
    return { ok: false, error: "Too many sign-in emails. Try again in a few minutes." };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = process.env.APP_URL ?? `${proto}://${host}`;

  const token = signMagicToken(email, mode);
  const url = `${base}/verify?token=${encodeURIComponent(token)}`;

  const { subject, html, text } = magicLinkEmail({
    url,
    email,
    expiresInMinutes: MAGIC_TOKEN_TTL_MINUTES,
  });

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject,
    html,
    text,
  });

  if (error) {
    console.error("[sendMagicLink] resend error", error);
    return { ok: false, error: "We couldn't send the email. Please try again." };
  }

  return { ok: true, email };
}
