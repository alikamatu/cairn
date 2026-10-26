export default function Page() {
  return (
    <>
      <h1>Getting started</h1>
      <p>You&apos;ll be on the Today board in under two minutes.</p>

      <h2>1. Sign in</h2>
      <p>
        Visit <a href="/signin">the sign-in page</a> and continue with Google, GitHub, or Apple.
        No passwords and no email forms — SSO only.
      </p>

      <h2>2. Onboarding</h2>
      <p>The wizard asks for four things:</p>
      <ul>
        <li><strong>Display name</strong> — how Cairn greets you each morning.</li>
        <li><strong>Avatar</strong> — pick one from the gallery; you can change this any time.</li>
        <li><strong>Theme</strong> — five built-in themes. Try them all; they&apos;re live preview.</li>
        <li><strong>Timezone &amp; start of week</strong> — we auto-detect the timezone; confirm or override.</li>
      </ul>

      <h2>3. The daily rhythm</h2>
      <p>
        Cairn is opinionated about one thing: every day starts on the <strong>Today</strong> board. The shape of the board is:
      </p>
      <ul>
        <li><strong>Habits row</strong> — tap to check off; streaks update instantly.</li>
        <li><strong>Tasks list</strong> — drag to reorder, click the circle to complete.</li>
        <li><strong>Focus timer</strong> — 25-minute deep-work blocks with a 5-minute break.</li>
        <li><strong>Schedule preview</strong> — your timed tasks for the day, stacked.</li>
      </ul>

      <h2>4. Keyboard</h2>
      <p>
        Press <kbd>⌘K</kbd> for the command palette, <kbd>?</kbd> for the cheatsheet, <kbd>N</kbd> for quick capture.
        Chord navigation uses <kbd>g</kbd> as a leader: <kbd>g t</kbd> = Today, <kbd>g h</kbd> = Habits, <kbd>g g</kbd> = Goals.
      </p>

      <h2>5. Next steps</h2>
      <ul>
        <li><a href="/docs/habits">Set up your first habit</a></li>
        <li><a href="/docs/goals">Draft a quarterly goal</a></li>
        <li><a href="/docs/assistant">Try the assistant</a></li>
      </ul>
    </>
  );
}
