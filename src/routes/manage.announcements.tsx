import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { SelectField, TextArea, TextField } from "@/components/form-fields";
import { useSession } from "@/lib/session";
import { staffClubs } from "@/lib/staff";

export const Route = createFileRoute("/manage/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — ClubBase Staff" },
      {
        name: "description",
        content:
          "Send an announcement to everyone in the clubs you sponsor — deadlines, room changes, and reminders.",
      },
      { property: "og:title", content: "Announcements — ClubBase Staff" },
      { property: "og:description", content: "Message every member of your club at once." },
    ],
  }),
  component: Announcements,
});

export function Announcements({ allowSchoolWide = false }: { allowSchoolWide?: boolean }) {
  const { session, clubs, teams, announcements, addAnnouncement, removeAnnouncement } =
    useSession();
  const mine = session ? staffClubs(clubs, session) : [];
  const ids = mine.map((c) => c.id);
  const teamIds = teams.map((team) => team.id);
  const targets = [
    ...(allowSchoolWide ? [{ value: "school:all", label: "Entire school" }] : []),
    ...mine.map((club) => ({ value: `club:${club.id}`, label: `Club · ${club.name}` })),
    ...teams.map((team) => ({ value: `team:${team.id}`, label: `Team · ${team.name}` })),
  ];
  const [picked, setPicked] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  if (!session) return null;
  const target = targets.some((item) => item.value === picked) ? picked : (targets[0]?.value ?? "");
  const [kind, targetId] = target.split(":");
  const posted = announcements.filter((post) =>
    post.schoolWide
      ? allowSchoolWide
      : post.clubId
        ? ids.includes(post.clubId)
        : !!post.teamId && teamIds.includes(post.teamId),
  );

  if (targets.length === 0) return <NoClubs />;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <section className="card-surface h-fit p-5">
        <h1 className="text-3xl leading-tight">Post an announcement</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Every member of that club or team sees it on their announcements tab.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            if (!targetId || !title.trim() || !body.trim()) {
              setOk("");
              setError("Pick an audience, then add a headline and a message.");
              return;
            }
            setBusy(true);
            const problem = await addAnnouncement({
              ...(kind === "school"
                ? { schoolWide: true }
                : kind === "club"
                  ? { clubId: targetId }
                  : { teamId: targetId }),
              title,
              body,
            });
            setBusy(false);
            setError(problem ?? "");
            const targetName =
              kind === "school"
                ? "the entire school"
                : kind === "club"
                  ? clubs.find((club) => club.id === targetId)?.name
                  : teams.find((team) => team.id === targetId)?.name;
            setOk(problem ? "" : `Sent to ${targetName}.`);
            if (!problem) {
              setTitle("");
              setBody("");
            }
          }}
        >
          <SelectField label="Audience" value={target} onChange={setPicked} options={targets} />
          <TextField
            label="Headline"
            value={title}
            onChange={setTitle}
            placeholder="Room change this week"
          />
          <TextArea
            label="Message"
            value={body}
            onChange={setBody}
            rows={5}
            placeholder="We're in the library Thursday — the shop is being resurfaced."
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {ok && <p className="text-sm text-success">{ok}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send announcement"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-2xl">Posted</h2>
        <ul className="mt-3 space-y-2">
          {posted.map((a) => (
            <li key={a.id} className="card-surface flex items-start gap-4 p-4">
              <div className="flex-1">
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.schoolWide
                    ? "Entire school"
                    : a.clubId
                      ? clubs.find((club) => club.id === a.clubId)?.name
                      : teams.find((team) => team.id === a.teamId)?.name}{" "}
                  ·{" "}
                  {new Date(`${a.postedAt}T12:00:00`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {a.author}
                </p>
                <p className="mt-2 text-sm">{a.body}</p>
              </div>
              <button
                onClick={() => void removeAnnouncement(a.id)}
                aria-label={`Delete ${a.title}`}
                className="rounded-md p-2 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {posted.length === 0 && (
            <li className="card-surface p-6 text-center text-sm text-muted-foreground">
              Nothing posted yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function NoClubs() {
  return (
    <div className="card-surface mx-auto max-w-lg p-10 text-center">
      <h1 className="text-3xl">Nobody to announce to yet</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Announcements go to club or team members, and you don't sponsor either yet.
      </p>
      <Link
        to="/manage"
        className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Create a club
      </Link>
    </div>
  );
}
