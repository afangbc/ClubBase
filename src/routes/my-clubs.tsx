import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatTime } from "@/lib/campus-data";
import { useSession } from "@/lib/session";
import { ClubCard } from "./clubs";

export const Route = createFileRoute("/my-clubs")({
  head: () => ({
    meta: [
      { title: "My Clubs — ClubHub" },
      {
        name: "description",
        content: "The clubs and teams you belong to, plus your pending requests to private clubs.",
      },
      { property: "og:title", content: "My Clubs — ClubHub" },
      { property: "og:description", content: "Your clubs, teams, and pending join requests." },
    ],
  }),
  component: () => (
    <AppShell>
      <MyClubs />
    </AppShell>
  ),
});

function MyClubs() {
  const { myClubs, pending, clubs, events, announcements } = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const mine = clubs.filter((c) => myClubs.includes(c.id));
  const requested = clubs.filter((c) => pending.includes(c.id));
  const upcoming = events
    .filter((e) => !!e.clubId && myClubs.includes(e.clubId) && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const latest = announcements.filter((a) => !!a.clubId && myClubs.includes(a.clubId)).slice(0, 3);

  return (
    <div>
      <h1 className="text-4xl">My Clubs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mine.length
          ? `${mine.length} club${mine.length > 1 ? "s" : ""} feeding your calendar.`
          : "You haven't joined anything yet."}
      </p>

      {mine.length === 0 ? (
        <div className="card-surface mt-6 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Head to the directory and join a club — its meetings show up on your calendar
            automatically.
          </p>
          <Link
            to="/clubs"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Browse clubs
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mine.map((c) => (
            <ClubCard key={c.id} club={c} details />
          ))}
        </div>
      )}

      {requested.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl">Pending requests</h2>
          <div className="mt-3 space-y-2">
            {requested.map((c) => (
              <div
                key={c.id}
                className="card-surface flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Waiting on {c.sponsorName} to approve you.
                  </p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                  <Clock className="size-3.5" /> Pending
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl">Next up</h2>
          <div className="mt-3 space-y-2">
            {upcoming.map((e) => (
              <div
                key={e.id}
                className="card-surface flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
              >
                <span className="font-semibold">{e.title}</span>
                <span className="text-xs text-muted-foreground">
                  {clubs.find((c) => c.id === e.clubId)?.name} · {e.location}
                </span>
                <span className="ml-auto text-xs font-semibold">
                  {new Date(`${e.date}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {formatTime(e.start)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl">From your sponsors</h2>
            <Link
              to="/announcements"
              className="text-xs font-semibold underline underline-offset-2"
            >
              See all announcements
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {latest.map((a) => (
              <div key={a.id} className="card-surface px-4 py-3">
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {clubs.find((c) => c.id === a.clubId)?.name} · {a.author}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
