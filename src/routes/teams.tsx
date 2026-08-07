import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, ShieldCheck, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/teams")({
  component: () => (
    <AppShell>
      <Teams />
    </AppShell>
  ),
});

function Teams() {
  const { teams, joinTeam } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-4xl">Teams</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Teams are private. Enter the code your coach or sponsor gave you.
      </p>
      <form
        className="card-surface mt-6 flex flex-col gap-3 p-5 sm:flex-row"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setMessage("");
          const problem = await joinTeam(code);
          setBusy(false);
          setError(problem ?? "");
          if (!problem) {
            setMessage("Team joined.");
            setCode("");
          }
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="TEAM-123456"
          className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2 font-mono tracking-widest"
        />
        <button
          disabled={busy || !code.trim()}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          {busy ? "Joining…" : "Join team"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-3 text-sm text-success">{message}</p>}
      <h2 className="mt-9 text-2xl">Your teams</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {teams.map((team) => (
          <article key={team.id} className="card-surface flex flex-col p-5">
            <Trophy className="mb-3 size-6 text-brand" />
            <h3 className="text-2xl">{team.name}</h3>
            <p className="text-sm text-muted-foreground">
              {team.sport} · {team.sponsorName}
            </p>
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-4" /> {team.members} players
            </p>
            <Link
              to="/teams/$teamId"
              params={{ teamId: team.id }}
              className="mt-4 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Eye className="size-4" /> View team page
            </Link>
          </article>
        ))}
        {teams.length === 0 && (
          <p className="card-surface p-7 text-center text-sm text-muted-foreground sm:col-span-2">
            <ShieldCheck className="mx-auto mb-2 size-7" />
            You haven’t joined a team yet.
          </p>
        )}
      </div>
    </div>
  );
}
