import { createFileRoute } from "@tanstack/react-router";
import { WeeklyDigest } from "@/components/WeeklyDigest";

export const Route = createFileRoute("/admin/weekly-digest")({
  head: () => ({ meta: [{ title: "Weekly Digest — ClubBase Admin" }] }),
  component: WeeklyDigest,
});

