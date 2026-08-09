import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { staffClubs } from "@/lib/staff";

export const Route = createFileRoute("/manage/requests")({
  head: () => ({
    meta: [
      { title: "Join Requests — ClubHub Staff" },
      {
        name: "description",
        content: "Approve or decline students requesting to join the private clubs you sponsor.",
      },
      { property: "og:title", content: "Join Requests — ClubHub Staff" },
      { property: "og:description", content: "Approve students into your clubs in one tap." },
    ],
  }),
  component: Requests,
});

function Requests() {
  const { session, clubs, requests, resolveRequest } = useSession();
  const [error, setError] = useState("");
  const [exiting, setExiting] = useState<Set<string>>(() => new Set());
  if (!session) return null;

  const ids = staffClubs(clubs, session).map((c) => c.id);
  const list = requests.filter((r) => ids.includes(r.clubId));

  const resolve = async (id: string, approve: boolean) => {
    const problem = await resolveRequest(id, approve);
    setError(problem ?? "");
    if (problem) {
      setExiting((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const beginApproval = (id: string) => {
    setError("");
    setExiting((current) => new Set(current).add(id));
  };

  return (
    <div className="max-w-3xl overflow-x-clip">
      <h1 className="text-4xl">Join Requests</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Students who followed the instructions on a private club you sponsor and are waiting on you.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {list.length === 0 ? (
        <p className="request-empty-in card-surface mt-6 p-6 text-center text-sm text-muted-foreground">
          No requests waiting. You're all caught up.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((r) => {
            const club = clubs.find((c) => c.id === r.clubId);
            return (
              <li
                key={r.id}
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget && exiting.has(r.id))
                    void resolve(r.id, true);
                }}
                className={`card-surface flex flex-wrap items-center gap-4 p-4 ${
                  exiting.has(r.id) ? "request-approved-out" : ""
                }`}
              >
                <div className="min-w-52 flex-1">
                  <p className="text-lg font-semibold leading-tight">{r.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.grade} · {r.email}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">{club?.name}</span>
                    {r.note ? ` — ${r.note}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => beginApproval(r.id)}
                    disabled={exiting.has(r.id)}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <Check className="size-4" /> Approve
                  </button>
                  <button
                    onClick={() => void resolve(r.id, false)}
                    disabled={exiting.has(r.id)}
                    className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-semibold hover:bg-secondary"
                  >
                    <X className="size-4" /> Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
