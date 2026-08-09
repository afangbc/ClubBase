import { Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarPlus,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  UserCheck,
  Trophy,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { roleLabel, schoolInitials } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

const nav = [
  { to: "/manage", label: "My Clubs", icon: LayoutDashboard },
  { to: "/manage/teams", label: "Teams", icon: Trophy },
  { to: "/manage/events", label: "Meetings / Events", icon: CalendarPlus },
  { to: "/manage/tutorials", label: "Tutorials", icon: CalendarCheck },
  { to: "/manage/announcements", label: "Announcements", icon: Megaphone },
  { to: "/manage/requests", label: "Requests", icon: UserCheck },
] as const;

export function StaffShell({ children }: { children: ReactNode }) {
  const { session, school, joined, ready, signOut } = useSession();
  const navigate = useNavigate();
  const allowed =
    session?.role === "teacher" && session.status === "active" && session.emailVerified && joined;

  useEffect(() => {
    if (!ready) return;
    if (!session) navigate({ to: "/", replace: true });
    else if (!session.emailVerified) navigate({ to: "/verify-email", replace: true });
    else if (session.role === "admin") navigate({ to: "/admin", replace: true });
    else if (session.role !== "teacher") navigate({ to: "/clubs", replace: true });
    else if (session.status !== "active") navigate({ to: "/pending", replace: true });
    else if (!joined) navigate({ to: "/", replace: true });
  }, [ready, session, joined, navigate]);

  if (!ready || !session || !allowed) return null;

  return (
    <div className="min-h-screen bg-secondary">
      <header className="sticky top-0 z-30 border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Link to="/manage" className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-lg bg-brand text-center font-display text-2xl leading-none text-brand-foreground">
              {schoolInitials(school?.name)}
            </span>
            <span className="font-display text-3xl leading-none">
              ClubHub <span className="text-brand">Sponsor</span>
            </span>
          </Link>
          <span className="hidden text-xs uppercase tracking-widest opacity-60 sm:inline">
            {school?.name} · {school?.district}
          </span>
          <div className="ml-auto mr-12 flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{session.name}</p>
              <p className="text-xs opacity-60">{roleLabel[session.role]}</p>
            </div>
            <Link
              to="/clubs"
              className="rounded-md border border-primary-foreground/25 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/10"
            >
              Student view
            </Link>
            <Link
              to="/account"
              aria-label="Account settings"
              className="rounded-md p-2 hover:bg-primary-foreground/10"
            >
              <Settings className="size-4" />
            </Link>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/", replace: true });
              }}
              aria-label="Sign out"
              className="rounded-md p-2 hover:bg-primary-foreground/10"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <nav className="flow-nav mx-auto flex max-w-6xl gap-1 px-2">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/manage" }}
              activeProps={{ className: "flow-nav-active text-brand" }}
              inactiveProps={{ className: "opacity-70" }}
              className="flow-nav-tab flex items-center gap-2 px-3.5 py-2.5 text-[15px] font-semibold"
            >
              <n.icon className="size-[18px]" />
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="page-content mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
