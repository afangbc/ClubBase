import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Check, Copy, LogOut, Plus, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { TextField } from "@/components/form-fields";
import { homeFor, type AdminRequest, type SchoolDetail } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Owner Console — ClubBase" },
      {
        name: "description",
        content: "Approve school admins and add campuses to ClubBase.",
      },
      { property: "og:title", content: "Owner Console — ClubBase" },
      { property: "og:description", content: "Approve school admins and add campuses." },
    ],
  }),
  component: OwnerConsole,
});

function OwnerConsole() {
  const { ready, session, schools, adminRequests, pendingAdminRequests, signOut } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!session) navigate({ to: "/", replace: true });
    else if (!session.owner || !session.emailVerified)
      navigate({ to: homeFor(session), replace: true });
  }, [ready, session, navigate]);

  if (!ready || !session?.owner || !session.emailVerified) return null;
  const decided = adminRequests.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-secondary">
      <header className="sticky top-0 z-30 border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <span className="grid size-8 place-items-center rounded-md bg-brand font-display text-lg text-brand-foreground">
            F
          </span>
          <span className="font-display text-2xl leading-none">
            ClubBase <span className="text-brand">Owner</span>
          </span>
          <div className="ml-auto mr-12 flex items-center gap-3">
            <span className="hidden text-xs opacity-70 sm:inline">{session.email}</span>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/", replace: true });
              }}
              aria-label="Sign out"
              className="rounded-md p-2 hover:bg-primary-foreground/10"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="page-content mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-4xl">Owner console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nobody gets a school without an owner review. Approving an application creates a separate
          campus, generates its student code, and assigns only its applicant as admin.
        </p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <h2 className="mt-8 text-2xl">
          Admin requests{" "}
          {pendingAdminRequests.length > 0 && (
            <span className="text-brand">({pendingAdminRequests.length})</span>
          )}
        </h2>
        {pendingAdminRequests.length === 0 ? (
          <p className="card-surface mt-3 p-6 text-center text-sm text-muted-foreground">
            Nobody is waiting. New requests from people who signed up as a school admin land here.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pendingAdminRequests.map((request) => (
              <RequestCard key={request.id} request={request} onError={setError} />
            ))}
          </ul>
        )}

        <h2 className="mt-10 text-2xl">Schools</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {schools.map((school) => (
            <SchoolCard key={school.id} school={school} />
          ))}
        </div>
        <NewSchool />

        {decided.length > 0 && (
          <>
            <h2 className="mt-10 text-2xl">Decided</h2>
            <ul className="mt-3 space-y-2">
              {decided.map((request) => (
                <li
                  key={request.id}
                  className="card-surface flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                >
                  <span className="font-semibold">{request.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {request.email} · {request.schoolName}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      request.status === "approved"
                        ? "bg-accent text-accent-foreground"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {request.status}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

function RequestCard({
  request,
  onError,
}: {
  request: AdminRequest;
  onError: (message: string) => void;
}) {
  const { reviewAdminRequest } = useSession();
  const [busy, setBusy] = useState(false);

  const decide = async (approve: boolean) => {
    if (busy) return;
    setBusy(true);
    onError((await reviewAdminRequest(request.id, approve)) ?? "");
    setBusy(false);
  };

  return (
    <li className="card-surface p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-52 flex-1">
          <p className="text-lg font-semibold leading-tight">{request.name}</p>
          <p className="text-xs text-muted-foreground">
            {request.email} · new school: {request.schoolName} · {request.district} ·{" "}
            {new Date(request.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => void decide(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Check className="size-4" /> Approve school
          </button>
          <button
            disabled={busy}
            onClick={() => void decide(false)}
            className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
          >
            <X className="size-4" /> Decline
          </button>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap rounded-md bg-secondary px-3 py-2 text-sm">
        {request.message}
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Mascot: {request.mascot}</span>
        <span
          className="size-5 rounded-full border border-border"
          style={{ backgroundColor: request.primaryColor }}
        />
        <span
          className="size-5 rounded-full border border-border"
          style={{ backgroundColor: request.secondaryColor }}
        />
      </div>
    </li>
  );
}

function SchoolCard({ school }: { school: SchoolDetail }) {
  const [copied, setCopied] = useState(false);

  return (
    <article className="card-surface p-4">
      <h3 className="text-2xl leading-tight">{school.name}</h3>
      <p className="text-xs text-muted-foreground">
        {school.district} · {school.mascot}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded-md bg-primary px-3 py-1.5 font-display text-xl tracking-[0.15em] text-primary-foreground">
          {school.joinCode}
        </code>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(school.joinCode);
            setCopied(true);
          }}
          className="flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-2 text-xs font-semibold hover:bg-accent"
        >
          <Copy className="size-3.5" /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {school.admins} {school.admins === 1 ? "admin" : "admins"} · {school.students} students ·{" "}
        {school.clubs} clubs
      </p>
      {school.admins === 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand">
          <ShieldCheck className="size-3.5" /> No admin yet — approve a request to hand it over.
        </p>
      )}
    </article>
  );
}

function NewSchool() {
  const { createSchool } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [mascot, setMascot] = useState("");
  const [primaryColor] = useState("#1d4ed8");
  const [secondaryColor] = useState("#facc15");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setDistrict("");
    setMascot("");
    setError("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="size-4" /> Add a school
      </button>
    );
  }

  return (
    <section className="card-surface mt-3 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="size-5 text-muted-foreground" />
        <h3 className="text-2xl leading-tight">Add a school</h3>
      </div>
      <form
        className="grid gap-3 md:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          const result = await createSchool({
            name,
            district,
            mascot,
            primaryColor,
            secondaryColor,
          });
          setBusy(false);
          setError(result.error ?? "");
          if (!result.error) {
            reset();
            setOpen(false);
          }
        }}
      >
        <TextField
          label="School name"
          value={name}
          onChange={setName}
          placeholder="Lebanon Trail High School"
        />
        <TextField
          label="District"
          value={district}
          onChange={setDistrict}
          placeholder="Example ISD"
        />
        <TextField label="Mascot" value={mascot} onChange={setMascot} placeholder="Trailblazers" />
        {error && <p className="text-sm text-destructive md:col-span-3">{error}</p>}
        <div className="flex gap-2 md:col-span-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create school"}
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        A campus join code is generated automatically. The school's admin can rotate it later.
      </p>
    </section>
  );
}
