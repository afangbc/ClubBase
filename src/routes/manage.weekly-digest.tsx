import { createFileRoute } from "@tanstack/react-router";
import { WeeklyDigest } from "@/components/WeeklyDigest";

export const Route = createFileRoute("/manage/weekly-digest")({
  head: () => ({ meta: [{ title: "Weekly Digest — ClubBase Sponsor" }] }),
  component: WeeklyDigest,
});

