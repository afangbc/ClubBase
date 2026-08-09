import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Eye, Globe, Lock, Megaphone, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { ClubForm } from "@/components/ClubForm";
import { SmoothCollapse } from "@/components/SmoothCollapse";
import type { Club } from "@/lib/campus-data";
import { useSession } from "@/lib/session";
import { campusRooms, staffClubs } from "@/lib/staff";

export const Route = createFileRoute("/manage/")({
  head: () => ({
    meta: [
      { title: "Sponsor Console — ClubBase Staff" },
      {
        name: "description",
        content:
          "The ClubBase console for club sponsors: create clubs, manage rosters, post meetings, and send announcements.",
      },
      { property: "og:title", content: "Sponsor Console — ClubBase Staff" },
      { property: "og:description", content: "Create a club, approve members, and post meetings." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { session, clubs, teams, events, requests, announcements, createClub } = useSession();
  const [creating, setCreating] = useState(false);
  if (!session) return null;

  const mine = staffClubs(clubs, session);
  const ids = mine.map((c) => c.id);
  const myRequests = requests.filter((r) => ids.includes(r.clubId));
  const teamIds = teams.map((team) => team.id);
  const myEvents = events.filter((event) =>
    event.clubId ? ids.includes(event.clubId) : !!event.teamId && teamIds.includes(event.teamId),
  );
  const myPosts = announcements.filter((post) =>
    post.clubId ? ids.includes(post.clubId) : !!post.teamId && teamIds.includes(post.teamId),
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Sponsor console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The clubs you sponsor, their rosters, and everything you post to them.
          </p>
        </div>
        <button
          onClick={() => setCreating((c) => !c)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" /> {creating ? "Close" : "Create a club"}
        </button>
      </div>

      <SmoothCollapse open={creating} openClassName="mt-4">
        <section className="card-surface p-5">
          <h2 className="text-2xl leading-tight">Create a club</h2>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            You're listed as the sponsor. Students see it in the directory as soon as you save.
          </p>
          <ClubForm
            rooms={campusRooms(clubs)}
            submitLabel="Create club"
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              const error = await createClub(input);
              if (!error) setCreating(false);
              return error;
            }}
          />
        </section>
      </SmoothCollapse>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Clubs sponsored" value={mine.length} />
        <Stat icon={Users} label="Pending requests" value={myRequests.length} />
        <Stat icon={CalendarDays} label="Meetings / events" value={myEvents.length} />
        <Stat icon={Megaphone} label="Announcements posted" value={myPosts.length} />
      </div>

      <div className="flow-up-in mt-4 flex flex-wrap gap-2">
        <Link
          to="/manage/events"
          className="rounded-md border border-input bg-card px-4 py-2 text-sm font-semibold hover:bg-accent"
        >
          Post a meeting / event
        </Link>
        <Link
          to="/manage/announcements"
          className="rounded-md border border-input bg-card px-4 py-2 text-sm font-semibold hover:bg-accent"
        >
          Send an announcement
        </Link>
        <Link
          to="/manage/requests"
          className="rounded-md border border-input bg-card px-4 py-2 text-sm font-semibold hover:bg-accent"
        >
          Review requests
        </Link>
      </div>

      <h2 className="mt-8 text-2xl">Your clubs</h2>
      {mine.length === 0 ? (
        <div className="card-surface mt-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            You don't sponsor a club yet. Create one and it shows up in the student directory
            immediately — or ask a school admin to move an existing club to your name.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Create your first club
          </button>
        </div>
      ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {mine.map((c) => (
            <ClubEditor
              key={c.id}
              club={c}
              rooms={campusRooms(clubs)}
              pending={requests.filter((r) => r.clubId === c.id).length}
            />
          ))}
        </div>
      )}
    </div>
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

function ClubEditor({ club, rooms, pending }: { club: Club; rooms: string[]; pending: number }) {
  const { updateClub, deleteClub } = useSession();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  return (
    <article className="card-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {club.logo && (
            <img
              src={club.logo}
              alt=""
              className="size-11 rounded-lg bg-card object-contain p-1 shadow-sm"
            />
          )}
          <div>
            <h3 className="text-2xl leading-tight">{club.name}</h3>
            <p className="text-xs text-muted-foreground">
              {club.members} members · {pending} pending · {club.meets}
            </p>
          </div>
        </div>
        <button
          onClick={async () =>
            setError(
              (await updateClub(club.id, {
                visibility: club.visibility === "public" ? "private" : "public",
              })) ?? "",
            )
          }
          title="Switch between instant joining and sponsor approval"
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
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
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Link
          to="/clubs/$clubId"
          params={{ clubId: club.id }}
          className="flex items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Eye className="size-4" /> View club page
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-input py-2 text-sm font-semibold hover:bg-secondary"
        >
          {open ? "Close settings" : "Edit club settings"}
        </button>
      </div>

      <SmoothCollapse open={open}>
        <div>
          <ClubForm
            key={club.id}
            rooms={rooms}
            submitLabel="Save changes"
            initial={{
              name: club.name,
              category: club.category,
              visibility: club.visibility,
              schedule: club.schedule,
              room: club.room,
              blurb: club.blurb,
              logo: club.logo ?? "",
              joinInstructions: club.joinInstructions ?? "",
            }}
            onSubmit={async (input) => {
              const problem = await updateClub(club.id, input);
              if (!problem) setOpen(false);
              return problem;
            }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {confirmDelete ? (
              <>
                <button
                  onClick={async () => setError((await deleteClub(club.id)) ?? "")}
                  className="rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-secondary"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-md border border-destructive px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" /> Delete club
              </button>
            )}
          </div>
        </div>
      </SmoothCollapse>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </article>
  );
}
