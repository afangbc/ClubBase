import { createFileRoute, Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — ClubHub" },
      {
        name: "description",
        content: "Everything your club and team sponsors have posted, newest first, in one feed.",
      },
      { property: "og:title", content: "Announcements — ClubHub" },
      {
        property: "og:description",
        content: "Deadlines and reminders from every club you joined.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <AnnouncementsPage />
    </AppShell>
  ),
});

function AnnouncementsPage() {
  const { myClubs, clubs, teams, announcements } = useSession();
  const [filter, setFilter] = useState("all");

  const feed = announcements.filter((post) => {
    const target = post.schoolWide
      ? "school"
      : post.clubId
        ? `club:${post.clubId}`
        : `team:${post.teamId}`;
    const joinedTarget = post.schoolWide
      ? true
      : post.clubId
        ? myClubs.includes(post.clubId)
        : !!post.teamId && teams.some((team) => team.id === post.teamId);
    return joinedTarget && (filter === "all" || target === filter);
  });
  const joined = clubs.filter((c) => myClubs.includes(c.id));

  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl">Announcements</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        School-wide updates and posts from the clubs and teams you joined — newest first.
      </p>

      {(joined.length + teams.length > 1 || announcements.some((post) => post.schoolWide)) && (
        <div className="control-flow-in mt-6 flex flex-wrap gap-1.5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          {announcements.some((post) => post.schoolWide) && (
            <Chip active={filter === "school"} onClick={() => setFilter("school")}>School-wide</Chip>
          )}
          {joined.map((c) => (
            <Chip key={c.id} active={filter === `club:${c.id}`} onClick={() => setFilter(`club:${c.id}`)}>
              {c.name}
            </Chip>
          ))}
          {teams.map((team) => <Chip key={team.id} active={filter === `team:${team.id}`} onClick={() => setFilter(`team:${team.id}`)}>{team.name}</Chip>)}
        </div>
      )}

      {myClubs.length === 0 && teams.length === 0 && !announcements.some((post) => post.schoolWide) ? (
        <div className="card-surface mt-6 p-10 text-center text-sm text-muted-foreground">
          Join a club or team and its announcements land here.{" "}
          <Link to="/clubs" className="font-semibold text-foreground underline">
            Browse the directory
          </Link>
          .
        </div>
      ) : feed.length === 0 ? (
        <div className="card-surface mt-6 p-10 text-center text-sm text-muted-foreground">
          Nothing posted yet. Your sponsors will show up here first.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {feed.map((a) => (
            <li key={a.id} className="card-surface p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                  <Megaphone className="size-4" />
                </span>
                <div className="flex-1">
                  <h2 className="text-2xl leading-tight">{a.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {a.schoolWide ? "School-wide" : a.clubId ? clubs.find((club) => club.id === a.clubId)?.name : teams.find((team) => team.id === a.teamId)?.name} · {a.author} ·{" "}
                    {new Date(`${a.postedAt}T12:00:00`).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="mt-3 text-sm">{a.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
