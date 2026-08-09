import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, Check, Clock3, MapPin, Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatTime } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/tutorials")({
  head: () => ({ meta: [{ title: "Tutorials — ClubBase" }] }),
  component: () => (
    <AppShell>
      <Tutorials />
    </AppShell>
  ),
});

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

function Tutorials() {
  const {
    tutorialTeachers,
    selectedTutorialTeachers,
    tutorials,
    setTutorialTeacher,
    setTutorialSignup,
  } = useSession();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const teachers = useMemo(
    () =>
      tutorialTeachers.filter((teacher) =>
        `${teacher.name} ${teacher.department ?? ""}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [tutorialTeachers, query],
  );
  const visible = tutorials.filter((tutorial) => !tutorial.cancelled);

  const act = async (key: string, call: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(key);
    setError((await call()) ?? "");
    setBusy("");
  };

  return (
    <div>
      <h1 className="text-4xl">Tutorials</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add your teachers, see their upcoming availability, and reserve a spot.
      </p>

      <section className="card-surface mt-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl">My teachers</h2>
            <p className="text-xs text-muted-foreground">
              Only selected teachers appear in your tutorial schedule.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a teacher"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
            />
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((teacher) => {
            const selected = selectedTutorialTeachers.includes(teacher.id);
            return (
              <button
                key={teacher.id}
                disabled={!!busy}
                onClick={() =>
                  void act(teacher.id, () => setTutorialTeacher(teacher.id, !selected))
                }
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${selected ? "border-primary bg-primary/8" : "border-border bg-secondary/30 hover:border-primary/50"}`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full ${selected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}
                >
                  {selected ? <Check className="size-4" /> : <UserPlus className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{teacher.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {teacher.department ?? teacher.email}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2">
          <CalendarCheck className="size-5 text-primary" />
          <h2 className="text-2xl">Upcoming tutorial times</h2>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {visible.map((tutorial) => (
            <article key={tutorial.id} className="card-surface flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl">{tutorial.teacherName}</h3>
                  <p className="text-xs font-semibold text-primary">
                    {dateLabel(tutorial.date)} {tutorial.recurring && "· Every week"}
                  </p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
                  <Users className="size-3.5" /> {tutorial.signupCount}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock3 className="size-3.5" /> {formatTime(tutorial.start)}–
                  {formatTime(tutorial.end)}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> {tutorial.location}
                </span>
              </div>
              <button
                disabled={!!busy}
                onClick={() =>
                  void act(tutorial.id, () =>
                    setTutorialSignup(tutorial.scheduleId, tutorial.date, !tutorial.signedUp),
                  )
                }
                className={`mt-4 rounded-md py-2 text-sm font-semibold transition ${tutorial.signedUp ? "border border-success/40 bg-success/10 text-success" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
              >
                {tutorial.signedUp ? "Signed up — cancel spot" : "Sign up"}
              </button>
            </article>
          ))}
        </div>
        {selectedTutorialTeachers.length === 0 && (
          <Empty text="Add at least one teacher above to see tutorial times." />
        )}
        {selectedTutorialTeachers.length > 0 && visible.length === 0 && (
          <Empty text="Your teachers have not published any upcoming tutorial times yet." />
        )}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card-surface mt-3 p-10 text-center text-sm text-muted-foreground">{text}</div>
  );
}
