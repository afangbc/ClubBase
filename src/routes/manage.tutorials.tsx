import { createFileRoute } from "@tanstack/react-router";
import { CalendarOff, Clock3, MapPin, Repeat2, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { formatTime } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/manage/tutorials")({
  component: StaffTutorials,
});
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

function StaffTutorials() {
  const { tutorials, createTutorial, deleteTutorial, setTutorialCancellation } = useSession();
  const [mode, setMode] = useState<"weekly" | "temporary">("weekly");
  const [days, setDays] = useState<number[]>([]);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("15:30");
  const [end, setEnd] = useState("16:30");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rules = [...new Map(tutorials.map((item) => [item.scheduleId, item])).values()];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const inputs =
      mode === "weekly"
        ? days.map((weekday) => ({ recurring: true, weekday, start, end, location }))
        : [{ recurring: false, date, start, end, location }];
    if (!inputs.length) {
      setMessage("Choose at least one weekday.");
      setBusy(false);
      return;
    }
    for (const input of inputs) {
      const error = await createTutorial(input);
      if (error) {
        setMessage(error);
        setBusy(false);
        return;
      }
    }
    setMessage(
      mode === "weekly" ? "Weekly tutorial times saved." : "Temporary tutorial time added.",
    );
    setDays([]);
    setDate("");
    setBusy(false);
  };

  return (
    <div>
      <h1 className="text-4xl">Tutorials</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Publish weekly availability, add one-time sessions, and manage student signups.
      </p>
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4 self-start">
          <form onSubmit={submit} className="card-surface p-5">
            <h2 className="text-2xl">Add tutorial times</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("weekly")}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "weekly" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                <Repeat2 className="mr-1.5 inline size-4" />
                Every week
              </button>
              <button
                type="button"
                onClick={() => setMode("temporary")}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "temporary" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                Only one date
              </button>
            </div>
            {mode === "weekly" ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Days of the week
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAYS.map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setDays((current) =>
                          current.includes(index)
                            ? current.filter((item) => item !== index)
                            : [...current, index],
                        )
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${days.includes(index) ? "bg-brand text-brand-foreground" : "border border-input bg-card"}`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Field label="Date">
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                  className="input"
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <input
                  type="time"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  required
                  className="input"
                />
              </Field>
              <Field label="End">
                <input
                  type="time"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  required
                  className="input"
                />
              </Field>
            </div>
            <Field label="Location">
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Room B-214"
                required
                className="input"
              />
            </Field>
            <button
              disabled={busy}
              className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Saving…" : "Publish tutorial times"}
            </button>
            {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
          </form>
          {rules.some((item) => item.recurring) && (
            <div className="card-surface p-4">
              <h3 className="text-lg">Weekly tutorials</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Removing a tutorial deletes all of its future weekly times.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {rules
                  .filter((item) => item.recurring)
                  .map((item) => (
                    <button
                      key={item.scheduleId}
                      onClick={() => void deleteTutorial(item.scheduleId)}
                      className="rounded-full border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      Remove {DAYS[new Date(`${item.date}T12:00:00`).getDay()]}{" "}
                      {formatTime(item.start)}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
        <section>
          <h2 className="text-2xl">Your upcoming schedule</h2>
          <div className="mt-3 space-y-3">
            {tutorials.map((item) => (
              <article
                key={item.id}
                className={`card-surface p-4 ${item.cancelled ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl">
                      {dateLabel(item.date)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {item.recurring ? "· Weekly" : "· Temporary"}
                      </span>
                    </h3>
                    <p className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        <Clock3 className="mr-1 inline size-3.5" />
                        {formatTime(item.start)}–{formatTime(item.end)}
                      </span>
                      <span>
                        <MapPin className="mr-1 inline size-3.5" />
                        {item.location}
                      </span>
                    </p>
                  </div>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                    <Users className="mr-1 inline size-3.5" />
                    {item.signupCount} signed up
                  </span>
                </div>
                {item.studentNames?.length ? (
                  <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-xs">
                    <b>Students:</b> {item.studentNames.join(", ")}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">No students signed up yet.</p>
                )}
                <div className="mt-3 flex gap-2">
                  {item.recurring && (
                    <button
                      onClick={() =>
                        void setTutorialCancellation(item.scheduleId, item.date, !item.cancelled)
                      }
                      className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                    >
                      <CalendarOff className="size-3.5" />
                      {item.cancelled ? "Restore this week" : "Cancel this week only"}
                    </button>
                  )}
                  {!item.recurring && (
                    <button
                      onClick={() => void deleteTutorial(item.scheduleId)}
                      className="flex items-center gap-1.5 rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      Delete temporary time
                    </button>
                  )}
                </div>
              </article>
            ))}
            {tutorials.length === 0 && (
              <p className="card-surface p-8 text-center text-sm text-muted-foreground">
                No tutorial times published yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
