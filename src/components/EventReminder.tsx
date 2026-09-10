import { Link } from "@tanstack/react-router";
import { BellRing, CalendarClock, MapPin, X } from "lucide-react";
import { useMemo, useState } from "react";
import { eventGroupName, eventStart, relevantEvents } from "@/lib/event-notifications";
import { formatTime } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

const REMINDER_WINDOW_MS = 60 * 60 * 1000;

export function EventReminder() {
  const { session, prefs, clubs, teams, myClubs, events } = useSession();
  const [dismissed, setDismissed] = useState(() => new Set<string>());

  const reminder = useMemo(() => {
    if (!session || !prefs.eventReminders) return null;
    const now = Date.now();
    return (
      relevantEvents(events, { session, clubs, teams, myClubs })
        .filter((event) => {
          const until = eventStart(event).getTime() - now;
          return until >= 0 && until <= REMINDER_WINDOW_MS && !dismissed.has(event.id);
        })
        .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())[0] ?? null
    );
  }, [session, prefs.eventReminders, clubs, teams, myClubs, events, dismissed]);

  if (!reminder) return null;

  const minutes = Math.max(0, Math.ceil((eventStart(reminder).getTime() - Date.now()) / 60_000));
  const timing = minutes <= 1 ? "Starting now" : `Starts in ${minutes} minutes`;

  return (
    <aside
      role="status"
      className="fixed bottom-5 right-5 z-40 w-[calc(100%-2.5rem)] max-w-sm animate-in slide-in-from-bottom-4 rounded-xl border border-brand/45 bg-card p-4 text-card-foreground shadow-xl duration-500"
    >
      <button
        type="button"
        aria-label="Dismiss event reminder"
        onClick={() => setDismissed((current) => new Set(current).add(reminder.id))}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex gap-3 pr-7">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-brand">Event reminder</p>
          <h2 className="mt-0.5 truncate text-lg font-semibold">{reminder.title}</h2>
          <p className="text-sm text-muted-foreground">
            {eventGroupName(reminder, clubs, teams)} · {timing}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5 text-brand" />
          {formatTime(reminder.start)}–{formatTime(reminder.end)}
        </span>
        {reminder.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-brand" />
            {reminder.location}
          </span>
        )}
      </div>
      <Link
        to="/calendar"
        className="mt-3 inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Open calendar
      </Link>
    </aside>
  );
}

