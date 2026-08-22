import type { MeetingSchedule } from "@/lib/campus-data";
import { scheduleFromText, timeFromText } from "./legacy";
import { buildSeedDatabase, DB_VERSION, type Database } from "./schema";
import { getStorageDriver } from "./storage";

let ready: Promise<Database> | null = null;
/** Writes are chained so two concurrent requests can't clobber each other. */
let writeChain: Promise<unknown> = Promise.resolve();

// ------------------------------------------------------------------ migration

type LegacyClub = { meets?: string; schedule?: MeetingSchedule };
type LegacyEvent = { start?: string; end?: string };
type LegacyDatabase = Database & {
  /** Version 1 held a single school rather than a list. */
  school?: Database["schools"][number];
  schoolVerifications?: unknown;
};

/**
 * Brings an older database up to the current shape in place. Nothing is dropped
 * except the school-verification queue, which backed the self-serve school
 * creation that owners now do themselves.
 */
async function migrate(parsed: LegacyDatabase): Promise<Database> {
  const next = parsed as LegacyDatabase;

  if (next.version === 4 && (next.users?.length ?? 0) === 0 && (next.clubs?.length ?? 0) === 0)
    return buildSeedDatabase();

  if (next.version === 1 && next.school) {
    next.schools = [next.school];
    delete next.school;
  }

  // Accounts that predate the email-verification rule are grandfathered in;
  // locking out an entire campus retroactively would be worse than the gap.
  next.users = (next.users ?? []).map((user) =>
    user.emailVerified === undefined ? { ...user, emailVerified: true } : user,
  );
  next.emailVerifications = next.emailVerifications ?? [];
  next.eventRsvps = next.eventRsvps ?? [];
  next.tutorialSchedules = next.tutorialSchedules ?? [];
  next.tutorialCancellations = next.tutorialCancellations ?? [];
  next.tutorialTeachers = next.tutorialTeachers ?? [];
  next.tutorialSignups = next.tutorialSignups ?? [];
  next.schoolDepartures = next.schoolDepartures ?? [];

  next.clubs = (next.clubs ?? []).map((club) => {
    const legacy = club as Database["clubs"][number] & LegacyClub;
    if (legacy.schedule) return club;
    legacy.schedule = scheduleFromText(legacy.meets ?? "");
    delete legacy.meets;
    return legacy;
  });

  next.events = (next.events ?? []).map((event) => {
    const legacy = event as unknown as LegacyEvent;
    return {
      ...event,
      start: timeFromText(legacy.start ?? "", "16:00"),
      end: timeFromText(legacy.end ?? "", "17:00"),
    };
  });

  next.adminRequests = next.adminRequests ?? [];
  next.schools = (next.schools ?? []).map((school) => ({
    ...school,
    primaryColor: school.primaryColor ?? "#1d4ed8",
    secondaryColor: school.secondaryColor ?? "#facc15",
  }));
  next.adminRequests = next.adminRequests.map((request) => {
    if (request.schoolName) return request;
    const oldSchool = next.schools.find((school) => school.id === request.schoolId);
    return {
      ...request,
      schoolName: oldSchool?.name ?? "New school",
      district: oldSchool?.district ?? "",
      mascot: oldSchool?.mascot ?? "",
      primaryColor: oldSchool?.primaryColor ?? "#1d4ed8",
      secondaryColor: oldSchool?.secondaryColor ?? "#facc15",
      // Legacy requests asked to take over an existing school. They must be
      // submitted again under the safer new-school-only workflow.
      status: request.status === "pending" ? "denied" : request.status,
    };
  });
  next.teams = next.teams ?? [];
  next.teamMemberships = next.teamMemberships ?? [];

  // Older builds represented sports teams as Athletics clubs. Move them out of
  // the club directory while preserving their existing members.
  const athleticClubs = next.clubs.filter((club) => club.category === "Athletics");
  for (const club of athleticClubs) {
    const teamId = `team_${club.id}`;
    if (!next.teams.some((team) => team.id === teamId)) {
      next.teams.push({
        id: teamId,
        schoolId: club.schoolId,
        name: club.name,
        sport: club.name,
        sponsorId: club.sponsorId,
        joinCode: `TEAM-${club.id
          .replace(/[^a-z0-9]/gi, "")
          .slice(-4)
          .toUpperCase()
          .padStart(4, "0")}`,
        createdAt: club.createdAt,
      });
      for (const member of next.memberships.filter(
        (item) => item.clubId === club.id && item.status === "member",
      ))
        next.teamMemberships.push({
          id: `tm_${member.id}`,
          teamId,
          userId: member.userId,
          createdAt: member.createdAt,
        });
    }
  }
  const athleticIds = new Set(athleticClubs.map((club) => club.id));
  next.clubs = next.clubs.filter((club) => !athleticIds.has(club.id));
  next.memberships = next.memberships.filter((item) => !athleticIds.has(item.clubId));
  next.events = next.events.filter((event) => !event.clubId || !athleticIds.has(event.clubId));
  next.announcements = next.announcements.filter(
    (announcement) => !announcement.clubId || !athleticIds.has(announcement.clubId),
  );
  delete next.schoolVerifications;
  next.version = DB_VERSION;
  return next as Database;
}

// ----------------------------------------------------------------- load/write

async function load(): Promise<Database> {
  const driver = await getStorageDriver();
  const raw = await driver.read();

  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as LegacyDatabase;
      if (parsed.version === DB_VERSION) return parsed;
      if (parsed.version >= 1 && parsed.version < DB_VERSION) {
        const migrated = await migrate(parsed);
        await driver.write(JSON.stringify(migrated, null, 2));
        console.info(`[clubbase] Migrated database to version ${DB_VERSION}.`);
        return migrated;
      }
      throw new Error(
        `[clubbase] Database is version ${String(parsed.version)}, but this build expects ${DB_VERSION}. Refusing to overwrite it.`,
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("[clubbase] The database is unreadable. Refusing to overwrite it.", {
          cause: error,
        });
      }
      throw error;
    }
  }

  const seeded = await buildSeedDatabase();
  await driver.write(JSON.stringify(seeded, null, 2));
  console.info(`[clubbase] Seeded a new database via ${driver.kind}.`);
  return seeded;
}

export function getDatabase(): Promise<Database> {
  if (!ready) {
    ready = load().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function persist(db: Database): Promise<void> {
  const driver = await getStorageDriver();
  await driver.write(JSON.stringify(db, null, 2));
}

/**
 * Read-modify-write against the database. The callback mutates the object in
 * place; the result is flushed to storage once it returns. If it throws, the
 * cache is dropped so the next read reloads the last durable state rather than
 * keeping a half-applied change in memory.
 */
export function transaction<T>(mutate: (db: Database) => T | Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const db = await getDatabase();
    try {
      const result = await mutate(db);
      await persist(db);
      return result;
    } catch (error) {
      ready = null;
      throw error;
    }
  };

  const next = writeChain.then(run, run);
  writeChain = next.catch(() => undefined);
  return next;
}

export async function query<T>(read: (db: Database) => T): Promise<T> {
  return read(await getDatabase());
}
