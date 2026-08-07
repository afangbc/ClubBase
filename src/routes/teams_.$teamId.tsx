import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Clock3,
  GraduationCap,
  Lock,
  Mail,
  MapPin,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatTime } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/teams_/$teamId")({
  head: () => ({
    meta: [
      { title: "Team Details — ClubHub" },
      { name: "description", content: "Team roster, announcements, meetings, and events." },
    ],
  }),
  component: () => (
    <AppShell>
      <TeamDetails />
    </AppShell>
  ),
});

function friendlyDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TeamDetails() {
  const { teamId } = Route.useParams();
  const { session, teams, teamMembers, events, eventRsvps, announcements } = useSession();
  const team = teams.find((candidate) => candidate.id === teamId);
  const backTo =
    session?.role === "admin"
      ? ({ to: "/admin/clubs", label: "Campus Clubs & Teams" } as const)
      : session?.role === "teacher"
        ? ({ to: "/manage/teams", label: "My Teams" } as const)
        : ({ to: "/teams", label: "My Teams" } as const);

  if (!team) {
    return (
      <div className="card-surface mx-auto max-w-xl p-10 text-center">
        <Lock className="mx-auto size-9 text-muted-foreground" />
        <h1 className="mt-4 text-3xl">Team page unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only team members, the team sponsor, and campus admins can view this page.
        </p>
        <Link
          to={backTo.to}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {backTo.label}
        </Link>
      </div>
    );
  }

  const members = teamMembers[team.id] ?? [];
  const teamEvents = events
    .filter((event) => event.teamId === team.id)
    .sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`));
  const posts = announcements
    .filter((post) => post.teamId === team.id)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));

  return (
    <div>
      <Link
        to={backTo.to}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {backTo.label}
      </Link>

      <section className="card-surface mt-4 overflow-hidden">
        <div className="border-b border-border bg-gradient-to-br from-primary/12 via-card to-brand/10 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid size-24 shrink-0 place-items-center rounded-2xl border border-border bg-card shadow-sm">
              <Trophy className="size-11 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                <Trophy className="size-3" /> Team
              </span>
              <h1 className="mt-3 text-4xl sm:text-5xl">{team.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{team.sport}</p>
            </div>
          </div>
        </div>
        <dl className="grid gap-px bg-border sm:grid-cols-3">
          <Detail icon={UserRound} label="Sponsor" value={team.sponsorName} />
          <Detail icon={Trophy} label="Sport or activity" value={team.sport} />
          <Detail
            icon={Users}
            label="Roster"
            value={`${team.members} player${team.members === 1 ? "" : "s"}`}
          />
        </dl>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <section>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              <h2 className="text-2xl">Meetings & events</h2>
            </div>
            <div className="mt-3 space-y-3">
              {teamEvents.map((event) => {
                const rsvps = eventRsvps.filter((rsvp) => rsvp.eventId === event.id);
                return (
                  <article key={event.id} className="card-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl">{event.title}</h3>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="size-3.5" /> {friendlyDate(event.date)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock3 className="size-3.5" /> {formatTime(event.start)}–
                            {formatTime(event.end)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="size-3.5" /> {event.location}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                        {rsvps.filter((rsvp) => rsvp.status === "going").length} going ·{" "}
                        {rsvps.filter((rsvp) => rsvp.status === "maybe").length} maybe
                      </span>
                    </div>
                    {event.description && (
                      <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                  </article>
                );
              })}
              {teamEvents.length === 0 && <Empty text="No meetings or events posted yet." />}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <Bell className="size-5 text-primary" />
              <h2 className="text-2xl">Announcements</h2>
            </div>
            <div className="mt-3 space-y-3">
              {posts.map((post) => (
                <article key={post.id} className="card-surface p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-xl">{post.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      {friendlyDate(post.postedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-primary">From {post.author}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {post.body}
                  </p>
                </article>
              ))}
              {posts.length === 0 && <Empty text="No announcements have been posted yet." />}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-primary" />
                <h2 className="text-2xl">Roster</h2>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                {team.members}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-secondary/35 p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{member.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <GraduationCap className="size-3.5" />{" "}
                      {member.grade ? `Grade ${member.grade}` : "Student"}
                    </p>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <p className="py-5 text-center text-sm text-muted-foreground">
                  No visible player profiles yet.
                </p>
              )}
            </div>
            {members.length < team.members && (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Some players keep their profile hidden from team rosters.
              </p>
            )}
          </section>

          <section className="card-surface p-5">
            <h2 className="text-2xl">Team information</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <Info label="Sport or activity" value={team.sport} />
              <Info label="Access" value="Private team code required" />
              {team.code && <Info label="Player join code" value={team.code} />}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sponsor contact
                </dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${team.sponsorEmail}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                  >
                    <Mail className="size-4" /> {team.sponsorEmail || "Not provided"}
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-card p-4">
      <Icon className="size-5 shrink-0 text-primary" />
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 leading-relaxed">{value}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="card-surface p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
