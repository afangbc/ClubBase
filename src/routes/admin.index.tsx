import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CalendarDays, Copy, Palette, RefreshCw, UserCog, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { TextField } from "@/components/form-fields";
import { CLUBBASE_COLORS } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Campus Console — ClubBase Admin" },
      {
        name: "description",
        content:
          "Issue the campus access code, review every club, and approve staff accounts for your school.",
      },
      { property: "og:title", content: "Campus Console — ClubBase Admin" },
      { property: "og:description", content: "Run ClubBase for your whole campus." },
    ],
  }),
  component: AdminHome,
});

function randomCode(schoolName = "CAMPUS") {
  const word =
    schoolName
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 8)
      .toUpperCase() || "CAMPUS";
  return `${word}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function AdminHome() {
  const {
    session,
    school,
    clubs,
    teams,
    events,
    announcements,
    staff,
    pendingStaff,
    schoolCode,
    updateSchoolCode,
  } = useSession();
  const [draft, setDraft] = useState(schoolCode);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // The code is loaded asynchronously, so seed the input once it arrives.
  useEffect(() => {
    setDraft((d) => (d ? d : schoolCode));
  }, [schoolCode]);

  if (!session) return null;

  const save = async (code: string) => {
    if (busy) return;
    setBusy(true);
    setDraft(code);
    const error = await updateSchoolCode(code);
    setBusy(false);
    setCopied(false);
    setMsg(
      error
        ? { ok: false, text: error }
        : {
            ok: true,
            text: `Code is now ${code.toUpperCase()}. The old code stops working for new sign-ins.`,
          },
    );
  };

  return (
    <div>
      <h1 className="text-4xl">Campus console</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {school?.name ?? "Your school"} · {school?.district ?? "Your district"} — you control the
        access code, the club list, and who gets a sponsor account.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Building2} label="Clubs on campus" value={clubs.length} />
        <Stat
          icon={UserCog}
          label="Sponsors approved"
          value={staff.filter((s) => s.status === "active").length}
        />
        <Stat icon={Users} label="Staff awaiting review" value={pendingStaff.length} />
        <Stat icon={CalendarDays} label="Meetings / events" value={events.length} />
      </div>

      <section className="card-surface mt-6 p-5">
        <h2 className="text-2xl leading-tight">School access code</h2>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">
          Students and teachers can't reach a single club until they enter this code. Rotate it at
          the start of a semester and nobody new can get in with the old one.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-primary px-4 py-2 font-display text-3xl tracking-[0.2em] text-primary-foreground">
            {schoolCode || "—"}
          </span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(schoolCode);
              setCopied(true);
            }}
            className="flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold hover:bg-accent"
          >
            <Copy className="size-4" /> {copied ? "Copied" : "Copy"}
          </button>
          <button
            disabled={busy}
            onClick={() => void save(randomCode(school?.name))}
            className="flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60"
          >
            <RefreshCw className="size-4" /> Generate new
          </button>
        </div>

        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(draft);
          }}
        >
          <div className="min-w-52 flex-1">
            <TextField
              label="Set a custom code"
              value={draft}
              onChange={(v) => setDraft(v.toUpperCase())}
              placeholder="YOUR-SCHOOL-2026"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            Save code
          </button>
        </form>
        {msg && (
          <p className={`mt-2 text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>
            {msg.text}
          </p>
        )}
      </section>

      <SchoolBranding />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel
          to="/admin/teachers"
          title="Staff accounts"
          body={
            pendingStaff.length
              ? `${pendingStaff.length} staff ${pendingStaff.length === 1 ? "account is" : "accounts are"} waiting on you. Until you approve them they can't create a club.`
              : "Every staff account on campus is reviewed. New sign-ups land here."
          }
          cta="Review staff"
        />
        <Panel
          to="/admin/clubs"
          title="Club directory"
          body={`Create a club and hand it to a sponsor, rename one, fix meeting times, or pull a club that folded. ${clubs.length} clubs live right now.`}
          cta="Manage clubs"
        />
      </div>

      <section className="mt-8">
        <h2 className="text-2xl">Latest campus activity</h2>
        <ul className="mt-3 space-y-2">
          {announcements.slice(0, 5).map((a) => (
            <li
              key={a.id}
              className="card-surface flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
            >
              <span className="w-20 shrink-0 text-xs font-semibold uppercase text-muted-foreground">
                {new Date(`${a.postedAt}T12:00:00`).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="font-semibold">{a.title}</span>
              <span className="text-xs text-muted-foreground">
                {a.clubId
                  ? clubs.find((club) => club.id === a.clubId)?.name
                  : teams.find((team) => team.id === a.teamId)?.name}{" "}
                · {a.author}
              </span>
            </li>
          ))}
          {announcements.length === 0 && (
            <li className="card-surface p-6 text-center text-sm text-muted-foreground">
              No announcements posted yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function SchoolBranding() {
  const { school, updateSchoolColors } = useSession();
  const [primaryColor, setPrimaryColor] = useState(school?.primaryColor ?? "#1d4ed8");
  const [secondaryColor, setSecondaryColor] = useState(school?.secondaryColor ?? "#facc15");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const usingClubBaseColors =
    primaryColor.toLowerCase() === CLUBBASE_COLORS.primaryColor &&
    secondaryColor.toLowerCase() === CLUBBASE_COLORS.secondaryColor;

  useEffect(() => {
    if (!school) return;
    setPrimaryColor(school.primaryColor);
    setSecondaryColor(school.secondaryColor);
  }, [school]);

  if (!school) return null;

  const saveColors = async (colors = { primaryColor, secondaryColor }, preset = false) => {
    if (busy) return;
    setBusy(true);
    setPrimaryColor(colors.primaryColor);
    setSecondaryColor(colors.secondaryColor);
    const error = await updateSchoolColors(colors);
    setBusy(false);
    setMessage(
      error
        ? { ok: false, text: error }
        : { ok: true, text: preset ? "ClubBase colors applied." : "School colors saved." },
    );
  };

  return (
    <section className="card-surface mt-6 p-5">
      <h2 className="text-2xl leading-tight">School colors</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        These colors appear throughout ClubBase for everyone enrolled at {school.name}.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await saveColors();
        }}
      >
        <ColorPicker label="Primary color" value={primaryColor} onChange={setPrimaryColor} />
        <ColorPicker label="Accent color" value={secondaryColor} onChange={setSecondaryColor} />
        <div
          className="flex h-12 overflow-hidden rounded-md border border-border"
          aria-label="Color preview"
        >
          <span className="w-16" style={{ backgroundColor: primaryColor }} />
          <span className="w-16" style={{ backgroundColor: secondaryColor }} />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save colors"}
        </button>
        <button
          type="button"
          disabled={busy || usingClubBaseColors}
          onClick={() => void saveColors({ ...CLUBBASE_COLORS }, true)}
          className="flex items-center gap-2 rounded-md border border-input bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-60"
        >
          <Palette className="size-4 text-brand" />
          {usingClubBaseColors ? "Using ClubBase colors" : "Use ClubBase colors"}
        </button>
      </form>
      {message && (
        <p className={`mt-3 text-sm ${message.ok ? "text-success" : "text-destructive"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}

function ColorPicker({
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
          className="w-24 rounded border border-input bg-background px-2 py-1 font-mono text-xs uppercase outline-none focus:border-ring"
          placeholder="#1D4ED8"
        />
      </span>
    </label>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="card-surface flex items-center gap-3 p-4">
      <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-display text-3xl leading-none">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Panel({
  to,
  title,
  body,
  cta,
}: {
  to: "/admin/teachers" | "/admin/clubs";
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <section className="card-surface flex flex-col p-5">
      <h2 className="text-2xl leading-tight">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{body}</p>
      <Link
        to={to}
        className="mt-4 self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {cta}
      </Link>
    </section>
  );
}
