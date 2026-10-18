import { createFileRoute } from "@tanstack/react-router";
import { SettingsApp } from "@/components/studio/settings-app";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return <SettingsApp />;
}
