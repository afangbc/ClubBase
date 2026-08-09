import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck, UserRound, Users } from "lucide-react";
import type { Role } from "@/lib/campus-data";
import { roleLabel } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "All Users — ClubBase Admin" },
      {
        name: "description",
        content: "View every student, teacher, and administrator enrolled at this school.",
      },
    ],
  }),
  component: AllUsers,
});

const roleIcon: Record<Role, typeof Users> = {
  student: GraduationCap,
  teacher: UserRound,
  admin: ShieldCheck,
};

function AllUsers() {
  const { users } = useSession();
  const counts: Record<Role, number> = {
    student: users.filter((user) => user.role === "student").length,
    teacher: users.filter((user) => user.role === "teacher").length,
    admin: users.filter((user) => user.role === "admin").length,
  };

  return (
    <div>
      <h1 className="text-4xl">All users</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every student, teacher, and administrator enrolled at this school.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(Object.keys(counts) as Role[]).map((role) => {
          const Icon = roleIcon[role];
          return (
            <div key={role} className="card-surface flex items-center gap-3 p-4">
              <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-display text-3xl leading-none">{counts[role]}</p>
                <p className="text-xs text-muted-foreground">{roleLabel[role]} accounts</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-surface mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => {
                const Icon = roleIcon[user.role];
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-semibold">
                      {user.name}
                      {user.grade && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {user.grade}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="size-3.5" /> {roleLabel[user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{user.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No enrolled users found.</p>
        )}
      </div>
    </div>
  );
}
