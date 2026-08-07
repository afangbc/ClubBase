import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, Eye, Plus, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { SmoothCollapse } from "@/components/SmoothCollapse";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/manage/teams")({ component: ManageTeams });

function ManageTeams() {
  const { teams, createTeam } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Your teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a roster and privately share its code with players.
          </p>
        </div>
        <button
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus /> {open ? "Close" : "Create a team"}
        </button>
      </div>
      <SmoothCollapse open={open} openClassName="mt-5">
        <form
          className="card-surface grid gap-4 p-5 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const problem = await createTeam({ name, sport });
            setBusy(false);
            setError(problem ?? "");
            if (!problem) {
              setName("");
              setSport("");
              setOpen(false);
            }
          }}
        >
          <label className="text-sm font-medium">
            Team name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Varsity Basketball"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Sport or activity
            <input
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              placeholder="Basketball"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <button
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:col-span-2"
          >
            {busy ? "Creating…" : "Create team and code"}
          </button>
        </form>
      </SmoothCollapse>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {teams.map((team) => (
          <article key={team.id} className="card-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl">{team.name}</h2>
                <p className="text-sm text-muted-foreground">{team.sport}</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-4" /> {team.members}
              </span>
            </div>
            <div className="mt-4 rounded-lg bg-secondary p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Player join code
              </p>
              <div className="mt-1 flex items-center justify-between">
                <code className="text-lg font-bold tracking-widest">{team.code}</code>
                <button
                  onClick={() => team.code && navigator.clipboard.writeText(team.code)}
                  aria-label="Copy team code"
                  className="rounded-md p-2 hover:bg-background"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </div>
            <Link
              to="/teams/$teamId"
              params={{ teamId: team.id }}
              className="mt-3 flex items-center justify-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-semibold hover:bg-secondary"
            >
              <Eye className="size-4" /> View team page
            </Link>
          </article>
        ))}
        {teams.length === 0 && (
          <div className="card-surface p-8 text-center text-sm text-muted-foreground md:col-span-2">
            <ShieldCheck className="mx-auto mb-2 size-7" />
            You haven’t created a team yet.
          </div>
        )}
      </div>
    </div>
  );
}
