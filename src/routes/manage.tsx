import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffShell } from "@/components/StaffShell";

export const Route = createFileRoute("/manage")({
  component: () => (
    <StaffShell>
      <Outlet />
    </StaffShell>
  ),
});
