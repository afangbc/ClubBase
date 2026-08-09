import { createFileRoute } from "@tanstack/react-router";
import { Announcements } from "./manage.announcements";

export const Route = createFileRoute("/admin/announcements")({
  head: () => ({
    meta: [{ title: "Announcements — ClubBase Admin" }],
  }),
  component: () => <Announcements allowSchoolWide />,
});
