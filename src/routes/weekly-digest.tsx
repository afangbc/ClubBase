import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { WeeklyDigest } from "@/components/WeeklyDigest";

export const Route = createFileRoute("/weekly-digest")({
  head: () => ({ meta: [{ title: "Weekly Digest — ClubBase" }] }),
  component: () => (
    <AppShell>
      <WeeklyDigest />
    </AppShell>
  ),
});

