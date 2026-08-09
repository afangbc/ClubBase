import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SelectField } from "@/components/form-fields";
import { GRADES, roleLabel, type Prefs } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account Settings — ClubHub" },
      {
        name: "description",
        content:
          "Manage your ClubHub profile, password, notification preferences, school membership, and account deletion.",
      },
      { property: "og:title", content: "Account Settings — ClubHub" },
      { property: "og:description", content: "Profile, password, notifications, and privacy." },
    ],
  }),
  component: () => (
    <AppShell>
      <AccountPage />
    </AppShell>
  ),
});

const prefRows: { key: keyof Prefs; label: string; hint: string }[] = [
  {
    key: "eventReminders",
    label: "Event reminders",
    hint: "Ping me an hour before a meeting starts.",
  },
  {
    key: "announcements",
    label: "Club announcements",
    hint: "Posts from sponsors and club leaders.",
  },
  { key: "weeklyDigest", label: "Weekly digest", hint: "A Sunday summary of the week ahead." },
  {
    key: "calendarSync",
    label: "Calendar sync",
    hint: "Mirror my club events to my school calendar.",
  },
  {
    key: "directoryVisible",
    label: "Show me in club rosters",
    hint: "Other members can see my name.",
  },
];

const gradeOptions = GRADES.map((grade) => ({ value: grade, label: grade }));

function AccountPage() {
  const {
    session,
    prefs,
    setPref,
    updateProfile,
    changePassword,
    signOut,
    deleteAccount,
    leaveSchool,
    myClubs,
    schoolCode,
    school,
  } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [grade, setGrade] = useState(session?.grade ?? GRADES[0]);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [leavePassword, setLeavePassword] = useState("");

  if (!session) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl">Account Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You're signed in as {roleLabel[session.role]} at {school?.name ?? "your school"}.
      </p>

      <Section title="Profile" desc="How your name shows up on rosters and requests.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const err = await updateProfile({ name, email, grade });
            setProfileMsg(err ? { ok: false, text: err } : { ok: true, text: "Profile saved." });
          }}
        >
          <Field label="Full name" value={name} onChange={setName} />
          <Field label="School email" value={email} onChange={setEmail} type="email" />
          {session.role === "student" && (
            <SelectField label="Grade" value={grade} onChange={setGrade} options={gradeOptions} />
          )}
          <div className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Role
            </span>
            <p className="text-sm">{roleLabel[session.role]}</p>
          </div>
          <Msg msg={profileMsg} />
          <Primary>Save profile</Primary>
        </form>
      </Section>

      <Section
        title="Password"
        desc="Stored as a salted PBKDF2 hash — changing it signs out every other device."
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const err = await changePassword(current, next, confirm);
            setPwMsg(err ? { ok: false, text: err } : { ok: true, text: "Password updated." });
            if (!err) {
              setCurrent("");
              setNext("");
              setConfirm("");
            }
          }}
        >
          <Field label="Current password" value={current} onChange={setCurrent} type="password" />
          <Field label="New password" value={next} onChange={setNext} type="password" />
          <Field
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            type="password"
          />
          <Msg msg={pwMsg} />
          <Primary>Update password</Primary>
        </form>
      </Section>

      <Section title="Notifications & privacy" desc="Control what ClubHub sends you.">
        <ul className="divide-y divide-border">
          {prefRows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-semibold">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[r.key]}
                aria-label={r.label}
                onClick={() => void setPref(r.key, !prefs[r.key])}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  prefs[r.key] ? "bg-primary" : "bg-secondary"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-card shadow transition-all ${
                    prefs[r.key] ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="School" desc="ClubHub only ever shows clubs from your campus.">
        <dl className="grid gap-2 text-sm">
          <Row k="School" v={school ? `${school.name} · ${school.mascot}` : "Not assigned"} />
          <Row k="District" v={school?.district ?? "—"} />
          {schoolCode && <Row k="Access code" v={schoolCode} />}
          <Row k="Clubs joined" v={String(myClubs.length)} />
        </dl>
      </Section>

      <Section
        title="Danger zone"
        desc="Leave your school, sign out, or permanently delete your account."
      >
        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/", replace: true });
            }}
            className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Sign out
          </button>
          {session.role !== "admin" && !confirmLeave && (
            <button
              type="button"
              onClick={() => {
                setConfirmDelete(false);
                setConfirmLeave(true);
              }}
              className="rounded-md border border-destructive px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              Leave school
            </button>
          )}
          {confirmDelete ? (
            <>
              <button
                onClick={async () => {
                  const err = await deleteAccount();
                  if (err) {
                    setDeleteError(err);
                    setConfirmDelete(false);
                    return;
                  }
                  navigate({ to: "/", replace: true });
                }}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, delete my account
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-md px-4 py-2 text-sm font-semibold hover:bg-secondary"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setConfirmLeave(false);
                setConfirmDelete(true);
              }}
              className="rounded-md border border-destructive px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              Delete account
            </button>
          )}
        </div>
        {session.role !== "admin" && confirmLeave && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm font-semibold">Warning: leave {school?.name ?? "this school"}?</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              This resets your club and team memberships, pending requests, RSVPs, and tutorial
              data. Sponsored clubs and teams will return to the campus admin. Your account will not
              be deleted. Your old school data is recoverable for 14 days, then it is deleted
              forever. Joining another school confirms the transfer early and permanently deletes
              the recovery copy. Staff must be approved again by the new school's admin.
            </p>
            <div className="mt-4 max-w-sm">
              <Field
                label="Enter your current password to continue"
                value={leavePassword}
                onChange={setLeavePassword}
                type="password"
                placeholder="Current password"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={leaving}
                onClick={async () => {
                  setLeaving(true);
                  setLeaveError("");
                  const err = await leaveSchool(leavePassword);
                  if (err) {
                    setLeaveError(err);
                    setLeaving(false);
                    return;
                  }
                  navigate({ to: "/", replace: true });
                }}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
              >
                {leaving ? "Leaving..." : "Yes, leave and reset my school data"}
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={() => {
                  setConfirmLeave(false);
                  setLeaveError("");
                  setLeavePassword("");
                }}
                className="rounded-md px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {leaveError && <p className="mt-3 text-sm text-destructive">{leaveError}</p>}
        {deleteError && <p className="mt-3 text-sm text-destructive">{deleteError}</p>}
      </Section>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface mt-6 p-5">
      <h2 className="text-2xl leading-tight">{title}</h2>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">{desc}</p>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>;
}

function Primary({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
      />
    </label>
  );
}
