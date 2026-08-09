import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, RefreshCw, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { homeFor, roleLabel } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/pending")({
  head: () => ({
    meta: [
      { title: "Waiting on approval — ClubBase" },
      {
        name: "description",
        content: "Your staff account is waiting for a school admin to approve it.",
      },
      { property: "og:title", content: "Waiting on approval — ClubBase" },
      { property: "og:description", content: "A school admin reviews every staff account." },
    ],
  }),
  component: Pending,
});

function Pending() {
  const { session, school, ready, signOut, refresh, joinSchool } = useSession();
  const navigate = useNavigate();
  const [changingSchool, setChangingSchool] = useState(false);
  const [schoolCode, setSchoolCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const waiting = session
    ? session.emailVerified && session.role !== "student" && session.status !== "active"
    : false;

  useEffect(() => {
    if (!ready) return;
    if (!session) navigate({ to: "/", replace: true });
    else if (!waiting) navigate({ to: homeFor(session), replace: true });
  }, [ready, session, waiting, navigate]);

  if (!ready || !session || !waiting) return null;
  const denied = session.status === "denied";
  const canChangeSchool = denied && session.role === "teacher";

  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-6">
      <div className="card-surface w-full max-w-lg p-8 text-center">
        <span
          className={`mx-auto grid size-14 place-items-center rounded-full ${
            denied ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"
          }`}
        >
          {denied ? <ShieldX className="size-7" /> : <Clock className="size-7" />}
        </span>
        <h1 className="mt-4 text-3xl">
          {denied ? "Staff access unavailable" : "Waiting on a school admin"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {denied ? (
            <>
              A {school?.name ?? "school"} admin revoked or declined this staff account. They can
              reinstate you, or you can request access at a different school below.
            </>
          ) : (
            <>
              Hi {session.name} — your staff account for {school?.name ?? "your school"} is in the
              admin queue. Once it's approved you can create clubs, post meetings, and send
              announcements.
            </>
          )}
        </p>
        <dl className="mt-6 grid gap-2 text-left text-sm">
          <div className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-muted-foreground">Account</dt>
            <dd className="font-semibold">{session.email}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-muted-foreground">Requested role</dt>
            <dd className="font-semibold">{roleLabel[session.role]}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className={`font-semibold ${denied ? "text-destructive" : ""}`}>
              {denied ? "Revoked / declined" : "Pending review"}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {canChangeSchool && !changingSchool && (
            <button
              onClick={() => setChangingSchool(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Enter a different school code
            </button>
          )}
          {!denied && (
            <button
              onClick={() => void refresh()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="size-4" /> Check again
            </button>
          )}
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/", replace: true });
            }}
            className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Sign out
          </button>
        </div>
        {canChangeSchool && changingSchool && (
          <form
            className="mt-5 border-t border-border pt-5 text-left"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              const message = await joinSchool(schoolCode);
              setError(message ?? "");
              setBusy(false);
              if (!message) await refresh();
            }}
          >
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New school access code
              </span>
              <input
                value={schoolCode}
                onChange={(event) => setSchoolCode(event.target.value.toUpperCase())}
                placeholder="ABCD-1234"
                autoFocus
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              This moves your account to that school's approval queue. Their admin must approve you
              before you can use staff tools.
            </p>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setChangingSchool(false);
                  setError("");
                }}
                className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                disabled={busy || !schoolCode.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Request new school"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
