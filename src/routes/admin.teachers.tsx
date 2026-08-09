import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Check, RotateCcw, ShieldOff, Trophy, Users, X } from "lucide-react";
import { useState } from "react";
import { roleLabel, type StaffAccount } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin/teachers")({
  head: () => ({
    meta: [
      { title: "Staff Accounts — ClubHub Admin" },
      {
        name: "description",
        content:
          "Approve or decline the teachers and admins requesting a staff account on your campus ClubHub.",
      },
      { property: "og:title", content: "Staff Accounts — ClubHub Admin" },
      { property: "og:description", content: "Decide who gets to sponsor a club." },
    ],
  }),
  component: AdminStaff,
});

function AdminStaff() {
  const { session, staff, clubs, teams, reviewStaff } = useSession();
  const [error, setError] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<StaffAccount | null>(null);
  const [revoking, setRevoking] = useState(false);

  const waiting = staff.filter((s) => s.status === "pending");
  const active = staff.filter((s) => s.status === "active");
  const declined = staff.filter((s) => s.status === "denied");

  const review = async (userId: string, approve: boolean) => {
    setError((await reviewStaff(userId, approve)) ?? "");
  };

  const confirmRevoke = async () => {
    if (!revokeTarget || revoking) return;
    setRevoking(true);
    const message = (await reviewStaff(revokeTarget.id, false)) ?? "";
    setError(message);
    setRevoking(false);
    if (!message) setRevokeTarget(null);
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-4xl">Staff accounts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Teachers who join with your campus code stay locked out of the sponsor console until you
        approve them here.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <h2 className="mt-8 text-2xl">
        Waiting on you{" "}
        {waiting.length > 0 && <span className="text-brand">({waiting.length})</span>}
      </h2>
      {waiting.length === 0 ? (
        <p className="card-surface mt-3 p-6 text-center text-sm text-muted-foreground">
          No staff accounts are pending. You're all caught up.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {waiting.map((s) => (
            <li key={s.id} className="card-surface flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-52 flex-1">
                <p className="text-lg font-semibold leading-tight">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.email} · {roleLabel[s.role]}
                  {s.department ? ` · ${s.department}` : ""}
                </p>
                {s.note && <p className="mt-2 text-sm">{s.note}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void review(s.id, true)}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Check className="size-4" /> Approve
                </button>
                <button
                  onClick={() => void review(s.id, false)}
                  className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-semibold hover:bg-secondary"
                >
                  <X className="size-4" /> Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-2xl">Approved staff</h2>
      <ul className="mt-3 space-y-2">
        {active.map((s) => (
          <Row
            key={s.id}
            staff={s}
            clubs={clubs.filter((club) => club.sponsorId === s.id).map((club) => club.name)}
            teams={teams.filter((team) => team.sponsorId === s.id).map((team) => team.name)}
            action={
              s.id === session?.id ? null : (
                <button
                  onClick={() => setRevokeTarget(s)}
                  className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                >
                  <ShieldOff className="size-3.5" /> Revoke access
                </button>
              )
            }
          />
        ))}
      </ul>

      {declined.length > 0 && (
        <>
          <h2 className="mt-10 text-2xl">Revoked or declined</h2>
          <ul className="mt-3 space-y-2">
            {declined.map((s) => (
              <Row
                key={s.id}
                staff={s}
                clubs={[]}
                teams={[]}
                action={
                  <button
                    onClick={() => void review(s.id, true)}
                    className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <RotateCcw className="size-3.5" /> Reinstate
                  </button>
                }
              />
            ))}
          </ul>
        </>
      )}

      {revokeTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !revoking) setRevokeTarget(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="revoke-title"
            aria-describedby="revoke-description"
            className="card-surface w-full max-w-md p-6 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h2 id="revoke-title" className="text-2xl">
                  Revoke staff access?
                </h2>
                <p id="revoke-description" className="mt-2 text-sm leading-6 text-muted-foreground">
                  <strong className="text-foreground">{revokeTarget.name}</strong> will immediately
                  lose access to the sponsor console and be signed out.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-brand/25 bg-brand/10 p-3 text-sm leading-5">
              Their account will not be deleted. You can reinstate their access later from this
              page.
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={revoking}
                onClick={() => setRevokeTarget(null)}
                className="rounded-md border border-input px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
              >
                Keep access
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={() => void confirmRevoke()}
                className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <ShieldOff className="size-4" /> {revoking ? "Revoking…" : "Revoke access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  staff,
  clubs,
  teams,
  action,
}: {
  staff: StaffAccount;
  clubs: string[];
  teams: string[];
  action: React.ReactNode;
}) {
  return (
    <li className="card-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <p className="text-base font-semibold">{staff.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {staff.email} · {roleLabel[staff.role]}
          </p>
        </div>
        {action}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Sponsorship icon={Users} label="Clubs" names={clubs} />
        <Sponsorship icon={Trophy} label="Teams" names={teams} />
      </div>
    </li>
  );
}

function Sponsorship({
  icon: Icon,
  label,
  names,
}: {
  icon: typeof Users;
  label: string;
  names: string[];
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-secondary/35 p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-background text-brand shadow-sm">
          <Icon className="size-4" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wider">
          {label} <span className="text-muted-foreground">· {names.length}</span>
        </p>
      </div>
      <div className="mt-3 flex min-h-7 flex-wrap gap-2">
        {names.length ? (
          names.map((name) => (
            <span
              key={name}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold shadow-sm"
            >
              {name}
            </span>
          ))
        ) : (
          <span className="self-center text-xs italic text-muted-foreground">None assigned</span>
        )}
      </div>
    </div>
  );
}
