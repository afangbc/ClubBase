import { createFileRoute } from "@tanstack/react-router";
import { Meetings } from "./manage.events";

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [{ title: "Meetings / Events — ClubHub Admin" }],
  }),
  component: Meetings,
});
