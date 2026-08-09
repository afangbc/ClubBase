import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Globe, Search, Check, Clock, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SmoothCollapse } from "@/components/SmoothCollapse";
import { CATEGORIES, type Club } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/clubs")({
  head: () => ({
    meta: [
      { title: "Club Directory — ClubBase" },
      {
        name: "description",
        content:
          "Browse every club and team at your school. Join public clubs instantly and see how to get into private ones.",
      },
      { property: "og:title", content: "Club Directory — ClubBase" },
      {
        property: "og:description",
        content: "Every club at your school in one searchable directory. No gatekeeping.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ClubsPage />
    </AppShell>
  ),
});

const categories = ["All", ...CATEGORIES] as const;

function ClubsPage() {
  const { clubs, school } = useSession();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof categories)[number]>("All");

  const results = useMemo(
    () =>
      clubs.filter(
        (c) =>
          (cat === "All" || c.category === cat) &&
          (c.name.toLowerCase().includes(q.toLowerCase()) ||
            c.sponsorName.toLowerCase().includes(q.toLowerCase())),
      ),
    [q, cat, clubs],
  );

  return (
    <div>
      <h1 className="text-4xl">Club Directory</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every club at {school?.name ?? "your school"} is listed here — private ones too.
      </p>

      <div className="control-flow-in mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clubs or sponsors"
            className="w-full rounded-md border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                cat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>
      {results.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No clubs match that search yet.
        </p>
      )}
    </div>
  );
}

export function ClubCard({ club, details = false }: { club: Club; details?: boolean }) {
  const { myClubs, pending, joinClub, leaveClub, requestClub } = useSession();
  const [showHow, setShowHow] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isMember = myClubs.includes(club.id);
  const isPending = pending.includes(club.id);

  const act = async (call: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setError((await call()) ?? "");
    setBusy(false);
  };

  return (
    <article className="card-surface flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {club.logo && (
            <img
              src={club.logo}
              alt=""
              className="size-11 shrink-0 rounded-lg bg-card object-contain p-1 shadow-sm"
            />
          )}
          <h2 className="text-2xl leading-tight">{club.name}</h2>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            club.visibility === "public"
              ? "bg-accent text-accent-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {club.visibility === "public" ? (
            <Globe className="size-3" />
          ) : (
            <Lock className="size-3" />
          )}
          {club.visibility}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{club.blurb}</p>
      <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex gap-2">
          <dt className="font-semibold text-foreground">Meets</dt>
          <dd>
            {club.meets} · {club.room}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-foreground">Sponsor</dt>
          <dd>
            {club.sponsorName} · {club.members} {club.members === 1 ? "member" : "members"}
          </dd>
        </div>
      </dl>

      <SmoothCollapse open={showHow}>
        <div className="space-y-2">
          {club.joinInstructions && (
            <p className="rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">
              <span className="font-semibold">How to join: </span>
              {club.joinInstructions}
            </p>
          )}
          {!isPending && !isMember && (
            <textarea
              value={note}
              rows={2}
              placeholder={`Anything ${club.sponsorName} should know? (optional)`}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          )}
        </div>
      </SmoothCollapse>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <div className="mt-auto flex gap-2 pt-4">
        {isMember ? (
          <>
            {details ? (
              <Link
                to="/clubs/$clubId"
                params={{ clubId: club.id }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                View club <ArrowRight className="size-4" />
              </Link>
            ) : (
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-success/12 py-2 text-sm font-semibold text-success">
                <Check className="size-4" /> Joined
              </span>
            )}
            <button
              disabled={busy}
              onClick={() => void act(() => leaveClub(club.id))}
              className="rounded-md border border-input px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
            >
              Leave
            </button>
          </>
        ) : club.visibility === "public" ? (
          <button
            disabled={busy}
            onClick={() => void act(() => joinClub(club.id))}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Joining…" : "Join club"}
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowHow((s) => !s)}
              className="flex-1 rounded-md border border-input py-2 text-sm font-semibold hover:bg-secondary"
            >
              {showHow ? "Hide steps" : "How to join"}
            </button>
            {isPending ? (
              <button
                disabled={busy}
                onClick={() => void act(() => leaveClub(club.id))}
                title="Withdraw your request"
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
              >
                <Clock className="size-3.5" /> Requested
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() => void act(() => requestClub(club.id, note))}
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                Request
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
