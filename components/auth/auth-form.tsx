"use client";

import { ProviderButton } from "./provider-button";

export function AuthForm() {
  return (
    <div className="w-full max-w-[420px]">
      <div className="space-y-2.5">
        <ProviderButton provider="google" onClick={() => { window.location.href = "/oauth/google"; }} />
        <ProviderButton provider="github" onClick={() => { window.location.href = "/oauth/github"; }} />
        <ProviderButton provider="apple" onClick={() => { window.location.href = "/oauth/apple"; }} />
      </div>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-fg-subtle">
        By continuing you agree to our{" "}
        <a href="/terms" className="text-fg-muted hover:text-fg">Terms</a>
        {" "}and{" "}
        <a href="/privacy" className="text-fg-muted hover:text-fg">Privacy Policy</a>.
      </p>
    </div>
  );
}
