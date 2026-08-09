import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Globe, Lock, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { ClubForm } from "@/components/ClubForm";
import { SmoothCollapse } from "@/components/SmoothCollapse";
import type { Club, StaffAccount } from "@/lib/campus-data";
import { useSession } from "@/lib/session";
import { campusRooms } from "@/lib/staff";

export const Route = createFileRoute("/admin/clubs")({
  head: () => ({
    meta: [
      { title: "Campus Clubs — ClubHub Admin" },
      {
        name: "description",
        content:
          "Create clubs, assign sponsors, and edit every club on campus: names, meeting times, rooms, and how students join.",
      },
      { property: "og:title", content: "Campus Clubs — ClubHub Admin" },
      { property: "og:description", content: "Create, rename, retime, and reassign any club." },
    ],
  }),
  component: AdminClubs,
});

function AdminClubs() {
  const { clubs, sponsors, createClub } = useSession();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const rooms = campusRooms(clubs);

  const results = clubs.filter(
    (c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.sponsorName.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Campus clubs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every club students can see. Start a new one, change a name, move a meeting, hand a club
            to a different sponsor, or remove one that folded.
          </p>
        </div>
        <button
          onClick={() => setCreating((c) => !c)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" /> {creating ? "Close" : "New club"}
        </button>
      </div>

      <SmoothCollapse open={creating} openClassName="mt-4">
        <section className="card-surface p-5">
          <h2 className="text-2xl leading-tight">Create a club</h2>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            Pick any approved sponsor — the club shows up in their console and in the student
            directory right away.
          </p>
          {sponsors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Approve a staff account first — a club needs a sponsor.
            </p>
          ) : (
            <ClubForm
              sponsors={sponsors}
              rooms={rooms}
              submitLabel="Create club"
              onCancel={() => setCreating(false)}
              onSubmit={async (input) => {
                const error = await createClub(input);
                if (!error) setCreating(false);
                return error;
              }}
            />
          )}
        </section>
      </SmoothCollapse>

      <div className="control-flow-in relative mt-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clubs or sponsors"
          className="w-full rounded-md border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
        />
      </div>

      <div className="mt-6 space-y-3">
        {results.map((club) => (
          <ClubRow key={club.id} club={club} sponsors={sponsors} rooms={rooms} />
        ))}
        {results.length === 0 && (
          <p className="card-surface p-6 text-center text-sm text-muted-foreground">
            No clubs match that search.
          </p>
        )}
      </div>
    </div>
  );
}

function ClubRow({
  club,
  sponsors,
  rooms,
}: {
  club: Club;
  sponsors: StaffAccount[];
  rooms: string[];
}) {
  const { updateClub, deleteClub } = useSession();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // A club can be sponsored by staff who were later revoked; keep them selectable.
  const options = sponsors.some((s) => s.id === club.sponsorId)
    ? sponsors
    : [
        ...sponsors,
        {
          id: club.sponsorId,
          name: club.sponsorName,
          email: club.sponsorEmail,
          role: "teacher",
          status: "active",
        } satisfies StaffAccount,
      ];

  return (
    <article className="card-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-52 flex-1 items-center gap-3">
          {club.logo && (
            <img
              src={club.logo}
              alt=""
              className="size-11 rounded-lg bg-card object-contain p-1 shadow-sm"
            />
          )}
          <div>
            <h2 className="text-2xl leading-tight">{club.name}</h2>
            <p className="text-xs text-muted-foreground">
              {club.sponsorName} · {club.meets} · {club.room} · {club.members} members
            </p>
          </div>
        </div>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
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
        </span>
        <Link
          to="/clubs/$clubId"
          params={{ clubId: club.id }}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Eye className="size-4" /> View page
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-input px-3 py-2 text-sm font-semibold hover:bg-secondary"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      <SmoothCollapse open={open} openClassName="mt-4">
        <div className="border-t border-border pt-4">
          <ClubForm
            key={club.id}
            sponsors={options}
            rooms={rooms}
            submitLabel="Save changes"
            initial={{
              name: club.name,
              category: club.category,
              visibility: club.visibility,
              sponsorId: club.sponsorId,
              schedule: club.schedule,
              room: club.room,
              blurb: club.blurb,
              logo: club.logo ?? "",
              joinInstructions: club.joinInstructions ?? "",
            }}
            onSubmit={(input) => updateClub(club.id, input)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {confirmDelete ? (
              <>
                <button
                  onClick={async () => setDeleteError((await deleteClub(club.id)) ?? "")}
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, remove {club.name}
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
                <Trash2 className="size-4" /> Remove club
              </button>
            )}
            {deleteError && <span className="text-sm text-destructive">{deleteError}</span>}
          </div>
        </div>
      </SmoothCollapse>
    </article>
  );
}
