import type { Club, ClubEvent, Session, Team } from "@/lib/campus-data";

type EventScope = {
  session: Session;
  clubs: Club[];
  teams: Team[];
  myClubs: string[];
};

/** Events that matter to the signed-in account, based on membership or sponsorship. */
export function relevantEvents(events: ClubEvent[], scope: EventScope): ClubEvent[] {
  const { session, clubs, teams, myClubs } = scope;
  if (session.role === "admin") return events;

  const clubIds =
    session.role === "teacher"
      ? clubs.filter((club) => club.sponsorId === session.id).map((club) => club.id)
      : myClubs;
  const teamIds =
    session.role === "teacher"
      ? teams.filter((team) => team.sponsorId === session.id).map((team) => team.id)
      : teams.map((team) => team.id);

  return events.filter((event) =>
    event.clubId
      ? clubIds.includes(event.clubId)
      : !!event.teamId && teamIds.includes(event.teamId),
  );
}

export function eventStart(event: ClubEvent): Date {
  return new Date(`${event.date}T${event.start}:00`);
}

export function eventEnd(event: ClubEvent): Date {
  return new Date(`${event.date}T${event.end}:00`);
}

export function eventGroupName(event: ClubEvent, clubs: Club[], teams: Team[]): string {
  if (event.clubId) return clubs.find((club) => club.id === event.clubId)?.name ?? "Club";
  return teams.find((team) => team.id === event.teamId)?.name ?? "Team";
}

