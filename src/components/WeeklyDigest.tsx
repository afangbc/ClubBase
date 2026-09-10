import { Link } from "@tanstack/react-router";
import { CalendarDays, CalendarRange, MapPin } from "lucide-react";
import { eventGroupName, eventStart, relevantEvents } from "@/lib/event-notifications";
import { formatTime } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

const DAY_MS = 24 * 60 * 60 * 1000;

export function WeeklyDigest() {
  const { session, prefs, clubs, teams, myClubs, events } = useSession();
  if (!session) return null;

  if (!prefs.weeklyDigest) {
    return (
      <div>
        <h1 className="text-4xl">Weekly digest</h1>
        <div className="card-surface mt-6 p-10 text-center">
          <CalendarRange className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-4 text-2xl">Weekly digest is turned off</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Enable it in Account Settings to see one organized view of your next seven days.
          </p>
          <Link
            to="/account"
            className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Open settings
          </Link>
        </div>
      </div>
    );
  }

  const now = new Date();
  const end = new Date(now.getTime() + 7 * DAY_MS);
  const upcoming = relevantEvents(events, { session, clubs, teams, myClubs })
    .filter((event) => {
      const start = eventStart(event);
      return start >= now && start < end;
    })
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime());

  const dateRange = `${now.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  })}–${end.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Your week ahead</p>
          <h1 className="mt-1 text-4xl">Weekly digest</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meetings and events relevant to your account for {dateRange}.
          </p>
        </div>
        <span className="rounded-full border border-brand/35 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand">
          {upcoming.length} event{upcoming.length === 1 ? "" : "s"}
        </span>
      </div>

      {upcoming.length === 0 ? (
        <div className="card-surface mt-6 p-10 text-center">
          <CalendarDays className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-4 text-2xl">Your week is clear</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No club or team meetings are scheduled in the next seven days.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {upcoming.map((event) => {
            const date = eventStart(event);
            return (
              <article key={event.id} className="card-surface flex flex-wrap items-center gap-4 p-5">
                <div className="grid min-w-20 place-items-center rounded-lg bg-brand/10 px-3 py-2 text-brand">
                  <span className="text-xs font-bold uppercase">{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <span className="font-display text-3xl leading-none">{date.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand">
                    {eventGroupName(event, clubs, teams)}
                  </p>
                  <h2 className="mt-0.5 text-xl">{event.title}</h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{formatTime(event.start)}–{formatTime(event.end)}</span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" /> {event.location}
                      </span>
                    )}
                  </div>
                  {event.description && <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

