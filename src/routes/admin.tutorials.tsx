import { createFileRoute } from "@tanstack/react-router";
import { Clock3, MapPin, Users } from "lucide-react";
import { formatTime } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin/tutorials")({
  component: AdminTutorials,
});
function AdminTutorials() {
  const { tutorials } = useSession();
  return (
    <div>
      <h1 className="text-4xl">Campus tutorials</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Read-only view of every teacher’s upcoming tutorial availability.
      </p>
      <div className="mt-6 space-y-3">
        {tutorials
          .filter((item) => !item.cancelled)
          .map((item) => (
            <article key={item.id} className="card-surface flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-52 flex-1">
                <h2 className="text-xl">{item.teacherName}</h2>
                <p className="text-xs text-primary">
                  {new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {item.recurring && "· Weekly"}
                </p>
              </div>
              <span className="text-sm">
                <Clock3 className="mr-1 inline size-4 text-muted-foreground" />
                {formatTime(item.start)}–{formatTime(item.end)}
              </span>
              <span className="text-sm">
                <MapPin className="mr-1 inline size-4 text-muted-foreground" />
                {item.location}
              </span>
              <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                <Users className="mr-1 inline size-3.5" />
                {item.signupCount} students
              </span>
            </article>
          ))}
        {tutorials.length === 0 && (
          <p className="card-surface p-10 text-center text-sm text-muted-foreground">
            No teachers have published tutorial times yet.
          </p>
        )}
      </div>
    </div>
  );
}
