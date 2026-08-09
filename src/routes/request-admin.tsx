import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, ShieldCheck, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { TextArea, TextField } from "@/components/form-fields";
import { homeFor } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/request-admin")({
  head: () => ({ meta: [{ title: "Apply for a new school — ClubBase" }] }),
  component: RequestAdmin,
});

function RequestAdmin() {
  const { ready, session, myAdminRequest, requestAdmin, signOut } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [mascot, setMascot] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1d4ed8");
  const [secondaryColor, setSecondaryColor] = useState("#facc15");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const waiting =
    session?.role === "admin" && session.emailVerified && !session.schoolId && !session.owner;

  useEffect(() => {
    if (!ready) return;
    if (!session) navigate({ to: "/", replace: true });
    else if (!waiting) navigate({ to: homeFor(session), replace: true });
  }, [ready, session, waiting, navigate]);

  if (!ready || !session || !waiting) return null;

  if (myAdminRequest?.status === "pending")
    return (
      <Frame>
        <StatusIcon kind="waiting" />
        <h1 className="mt-4 text-3xl">Waiting on ClubBase</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We've got your request to create {myAdminRequest.schoolName}. A ClubBase owner reviews
          every application by hand.
        </p>
        <dl className="mt-6 grid gap-2 text-left text-sm">
          <Row term="Account" value={session.email} />
          <Row term="New school" value={myAdminRequest.schoolName} />
          <Row term="District" value={myAdminRequest.district} />
          <Row term="Requested" value={new Date(myAdminRequest.createdAt).toLocaleDateString()} />
        </dl>
        <Footer onSignOut={signOut} />
      </Frame>
    );

  return (
    <Frame>
      {myAdminRequest?.status === "denied" ? (
        <>
          <StatusIcon kind="denied" />
          <h1 className="mt-4 text-3xl">That request was declined</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You can submit a revised new-school application with more information.
          </p>
        </>
      ) : (
        <>
          <StatusIcon kind="new" />
          <h1 className="mt-4 text-3xl">Add your school</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apply to create a separate school. After approval, you'll receive its unique student
            code and control only its branding, clubs, staff, and users.
          </p>
        </>
      )}
      <form
        className="mt-6 space-y-4 text-left"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          const problem = await requestAdmin({
            name,
            district,
            mascot,
            primaryColor,
            secondaryColor,
            message,
          });
          setBusy(false);
          setError(problem ?? "");
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
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Primary color" value={primaryColor} onChange={setPrimaryColor} />
          <ColorField label="Accent color" value={secondaryColor} onChange={setSecondaryColor} />
        </div>
        <TextArea
          label="Why you should run this school"
          value={message}
          onChange={setMessage}
          rows={5}
          placeholder="Your role at the school, who can verify it, and how your school will use ClubBase."
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Submit new-school application"}
        </button>
      </form>
      <Footer onSignOut={signOut} />
    </Frame>
  );
}

function StatusIcon({ kind }: { kind: "waiting" | "denied" | "new" }) {
  const Icon = kind === "waiting" ? Clock : kind === "denied" ? ShieldX : ShieldCheck;
  return (
    <span
      className={`mx-auto grid size-14 place-items-center rounded-full ${kind === "denied" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}
    >
      <Icon className="size-7" />
    </span>
  );
}
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [hex, setHex] = useState(value.toUpperCase());
  useEffect(() => setHex(value.toUpperCase()), [value]);
  const updateHex = (next: string) => {
    const formatted = (next.startsWith("#") ? next : `#${next}`).slice(0, 7).toUpperCase();
    setHex(formatted);
    if (/^#[0-9A-F]{6}$/.test(formatted)) onChange(formatted.toLowerCase());
  };
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 flex items-center gap-2 rounded-md border border-input bg-card p-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-12 cursor-pointer border-0 bg-transparent"
        />
        <input
          type="text"
          value={hex}
          onChange={(event) => updateHex(event.target.value)}
          onBlur={() => setHex(value.toUpperCase())}
          aria-label={`${label} hex code`}
          className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1 font-mono text-xs uppercase outline-none focus:border-ring"
          placeholder="#1D4ED8"
        />
      </span>
    </label>
  );
}
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-content grid min-h-screen place-items-center bg-secondary px-6 py-12">
      <div className="card-surface w-full max-w-lg p-8 text-center">{children}</div>
    </div>
  );
}
function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
function Footer({ onSignOut }: { onSignOut: () => Promise<string | null> }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={async () => {
        await onSignOut();
        navigate({ to: "/", replace: true });
      }}
      className="mt-6 text-sm text-muted-foreground underline underline-offset-2"
    >
      Sign out
    </button>
  );
}
