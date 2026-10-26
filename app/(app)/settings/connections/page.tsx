import { SettingsSection } from "@/components/settings/section";

export default function ConnectionsSettings() {
  return (
    <div className="space-y-6">
      <SettingsSection title="Sign-in providers" description="Cairn uses Google, GitHub, or Apple — SSO only.">
        <p className="text-[13px] text-fg-muted">
          You signed in with one of these providers. Managing linked accounts lands with the persistent user table.
        </p>
      </SettingsSection>
      <SettingsSection title="Calendars" description="Mirror tasks and habits onto your external calendar.">
        <p className="text-[13px] text-fg-muted">Google Calendar and ICS feeds — coming with the calendar feature.</p>
      </SettingsSection>
    </div>
  );
}
