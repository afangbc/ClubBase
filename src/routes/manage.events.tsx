import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ClockField, SelectField, TextArea, TextField } from "@/components/form-fields";
import { formatTime } from "@/lib/campus-data";
import { useSession } from "@/lib/session";
import { campusRooms, staffClubs } from "@/lib/staff";

export const Route = createFileRoute("/manage/events")({
  head: () => ({
    meta: [
      { title: "Meetings / Events — ClubHub Staff" },
      {
        name: "description",
        content:
          "Post and cancel meetings or events for the clubs and teams you sponsor. Members see them instantly.",
      },
      { property: "og:title", content: "Meetings / Events — ClubHub Staff" },
      {
        property: "og:description",
        content: "Schedule club and team events straight to student calendars.",
      },
    ],
  }),
  component: Meetings,
});

export function Meetings() {
  const { session, clubs, teams, events, addEvent, removeEvent } = useSession();
  const mine = session ? staffClubs(clubs, session) : [];
  const ids = mine.map((c) => c.id);
  const teamIds = teams.map((team) => team.id);
  const targets = [
    ...mine.map((club) => ({ value: `club:${club.id}`, label: `Club · ${club.name}` })),
    ...teams.map((team) => ({ value: `team:${team.id}`, label: `Team · ${team.name}` })),
  ];
  const [picked, setPicked] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("16:00");
  const [end, setEnd] = useState("17:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  if (!session) return null;
  const target = targets.some((item) => item.value === picked) ? picked : (targets[0]?.value ?? "");
  const [kind, targetId] = target.split(":");
  const list = events
    .filter((event) => (event.clubId ? ids.includes(event.clubId) : !!event.teamId && teamIds.includes(event.teamId)))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (targets.length === 0) return <NoClubs />;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <section className="card-surface h-fit p-5">
        <h1 className="text-3xl leading-tight">Post a meeting / event</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          It lands on every member's calendar right away.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            if (!targetId || !title.trim() || !date || !location.trim()) {
              setOk("");
              setError("Pick a club or team and fill in title, date, and location.");
              return;
            }
            setBusy(true);
            const posted = title.trim();
            const problem = await addEvent({
              ...(kind === "club" ? { clubId: targetId } : { teamId: targetId }),
              title: posted,
              date,
              start,
              end,
              location: location.trim(),
              description: description.trim(),
            });
            setBusy(false);
            setError(problem ?? "");
            setOk(problem ? "" : `"${posted}" posted.`);
            if (!problem) {
              setTitle("");
              setLocation("");
              setDescription("");
            }
          }}
        >
          <SelectField
            label="Club or team"
            value={target}
            onChange={setPicked}
            options={targets}
          />
          <TextField
            label="Title"
            value={title}
            onChange={setTitle}
            placeholder="General Meeting"
          />
          <TextField label="Date" value={date} onChange={setDate} type="date" />
          <div className="grid grid-cols-2 gap-3">
            <ClockField label="Start" value={start} onChange={setStart} />
            <ClockField label="End" value={end} onChange={setEnd} />
          </div>
          <TextField
            label="Location"
            value={location}
            onChange={setLocation}
            placeholder="C-214"
            suggestions={campusRooms(
              clubs,
              events.map((e) => e.location),
            )}
          />
          <TextArea
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            placeholder="Add anything students should know about this meeting or event."
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {ok && <p className="text-sm text-success">{ok}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Posting…" : "Post meeting / event"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-2xl">Scheduled meetings / events</h2>
        <ul className="mt-3 space-y-2">
          {list.map((e) => (
            <li key={e.id} className="card-surface flex items-center gap-4 p-3">
              <div className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">
                {new Date(`${e.date}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {(e.clubId ? clubs.find((club) => club.id === e.clubId)?.name : teams.find((team) => team.id === e.teamId)?.name)} · {formatTime(e.start)}–
                  {formatTime(e.end)} · {e.location}
                </p>
              </div>
              <button
                onClick={() => void removeEvent(e.id)}
                aria-label={`Cancel ${e.title}`}
                className="rounded-md p-2 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="card-surface p-6 text-center text-sm text-muted-foreground">
              Nothing scheduled yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function NoClubs() {
  return (
    <div className="card-surface mx-auto max-w-lg p-10 text-center">
      <h1 className="text-3xl">Nothing to schedule yet</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Meetings and events belong to a club or team, and you don't sponsor either yet.
      </p>
      <Link
        to="/manage"
        className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Create a club
      </Link>
    </div>
  );
}
