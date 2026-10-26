export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <article className="prose-cairn">
        <h1>Privacy policy</h1>
        <p><em>Last updated: May 19, 2026</em></p>

        <p>
          This policy describes what data Cairn collects, how we use it, and the controls you have. We aim to make this
          short and concrete — not a wall of boilerplate.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Account</strong> — your email address, and any name and avatar you choose during onboarding.</li>
          <li><strong>Content</strong> — the tasks, habits, goals, notes, and reviews you create inside Cairn.</li>
          <li><strong>Operational metadata</strong> — sign-in events, timezone, theme preference, basic device info.</li>
          <li><strong>Payment</strong> — handled entirely by Paystack. We never see your full card number.</li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To run the product: render your boards, authenticate via SSO, charge your subscription.</li>
          <li>To improve the product in aggregate — never by reading your individual content.</li>
          <li>To send transactional email (billing receipts) and, if you opt in, daily digests.</li>
        </ul>

        <h2>What we don&apos;t do</h2>
        <ul>
          <li>We don&apos;t train AI models on your content.</li>
          <li>We don&apos;t sell or share your data with advertisers.</li>
          <li>We don&apos;t run third-party analytics that read your tasks or notes.</li>
        </ul>

        <h2>Your controls</h2>
        <ul>
          <li><strong>Export</strong> — JSON, Markdown, or CSV from Settings → Data, any time.</li>
          <li><strong>Unsubscribe</strong> — every transactional email except sign-in confirmations has a one-click unsubscribe.</li>
          <li><strong>Delete</strong> — request a full account deletion from Settings → Danger zone. Hard-delete within 30 days.</li>
        </ul>

        <h2>Subprocessors</h2>
        <p>
          We rely on: <strong>Vercel</strong> (hosting), <strong>Resend</strong> (email delivery),
          <strong> Paystack</strong> (billing), <strong>Cloudinary</strong> (image storage), and our AI model provider for
          assistant features. Each is contractually bound to data-processing terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Email <a href="mailto:privacy@assistant.alikamatu.com">privacy@assistant.alikamatu.com</a>.
        </p>
      </article>
    </div>
  );
}
