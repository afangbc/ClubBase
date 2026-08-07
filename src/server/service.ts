import {
  CATEGORIES,
  GRADES,
  defaultPrefs,
  emailProblem,
  formatSchedule,
  normalizeSchedule,
  passwordProblem,
  type AdminRequest,
  type Announcement,
  type Club,
  type ClubMember,
  type ClubCategory,
  type ClubEvent,
  type EventRsvp,
  type EventRsvpStatus,
  type JoinRequest,
  type MeetingSchedule,
  type Prefs,
  type Role,
  type SchoolAccount,
  type SchoolDetail,
  type SchoolSummary,
  type Session,
  type StaffAccount,
  type Team,
  type TutorialOccurrence,
  type TutorialTeacher,
} from "@/lib/campus-data";
import {
  clearFailures,
  currentUser,
  endAllSessions,
  endSession,
  recordFailure,
  startSession,
  throttled,
} from "./auth";
import { hashPassword, hashToken, newId, verifyPassword } from "./crypto";
import { emailInConsoleMode, sendVerificationCode } from "./email";
import { isBootstrapAdmin, isOwner, ownersConfigured } from "./owners";
import { FRISCO_SCHOOL_ID } from "./schema";
import type { AdminRequestRecord, ClubRecord, Database, TeamRecord, UserRecord } from "./schema";
import { getDatabase, transaction } from "./store";

export type Result = { error: string | null };

const ok: Result = { error: null };
const fail = (error: string): Result => ({ error });

const norm = (value: string) => value.trim().toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);

/** Deliberately vague so sign-in can't be used to enumerate real addresses. */
const BAD_CREDENTIALS = "That email and password don't match an account.";

export type AppState = {
  user: Session | null;
  prefs: Prefs;
  school: {
    name: string;
    mascot: string;
    district: string;
    primaryColor: string;
    secondaryColor: string;
  } | null;
  clubs: Club[];
  clubMembers: Record<string, ClubMember[]>;
  teams: Team[];
  teamMembers: Record<string, ClubMember[]>;
  events: ClubEvent[];
  eventRsvps: EventRsvp[];
  announcements: Announcement[];
  tutorialTeachers: TutorialTeacher[];
  selectedTutorialTeachers: string[];
  tutorials: TutorialOccurrence[];
  myClubs: string[];
  pending: string[];
  requests: JoinRequest[];
  staff: StaffAccount[];
  /** Admins only — safe profile fields for everyone enrolled at the school. */
  users: SchoolAccount[];
  /** Admins only — nobody else is told the live campus code. */
  schoolCode: string;
  /** Owners only — every campus on the platform. */
  schools: SchoolDetail[];
  /** Owners only — the queue of people asking to run a campus. */
  adminRequests: AdminRequest[];
  /** The signed-in admin's own request, while they're waiting on an owner. */
  myAdminRequest: AdminRequest | null;
  /** Existing campuses, shown only to owners. */
  schoolOptions: SchoolSummary[];
  /** False when CLUBHUB_OWNER_EMAILS is unset, so setup can't fail silently. */
  ownersConfigured: boolean;
  /** True in local dev with no mail provider — codes go to the server console. */
  emailInConsoleMode: boolean;
  schoolDeparture: { schoolName: string; expiresAt: string } | null;
};

// ---------------------------------------------------------------- projections

function toSession(user: UserRecord): Session {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    ...(user.grade === undefined ? {} : { grade: user.grade }),
    emailVerified: user.emailVerified,
    schoolId: user.schoolId,
    owner: isOwner(user.email),
  };
}

function toClub(db: Database, club: ClubRecord): Club {
  const sponsor = db.users.find((u) => u.id === club.sponsorId);
  return {
    id: club.id,
    name: club.name,
    category: club.category,
    visibility: club.visibility,
    sponsorId: club.sponsorId,
    sponsorName: sponsor?.name ?? "Unassigned",
    sponsorEmail: sponsor?.email ?? "",
    room: club.room,
    schedule: club.schedule,
    meets: formatSchedule(club.schedule),
    members: db.memberships.filter((m) => m.clubId === club.id && m.status === "member").length,
    blurb: club.blurb,
    ...(club.logo ? { logo: club.logo } : {}),
    ...(club.joinInstructions === undefined ? {} : { joinInstructions: club.joinInstructions }),
  };
}

function toTeam(db: Database, team: TeamRecord, viewer: UserRecord): Team {
  const sponsor = db.users.find((user) => user.id === team.sponsorId);
  const canSeeCode = viewer.role === "admin" || team.sponsorId === viewer.id;
  return {
    id: team.id,
    name: team.name,
    sport: team.sport,
    sponsorId: team.sponsorId,
    sponsorName: sponsor?.name ?? "Unassigned",
    sponsorEmail: sponsor?.email ?? "",
    members: db.teamMemberships.filter((member) => member.teamId === team.id).length,
    ...(canSeeCode ? { code: team.joinCode } : {}),
  };
}

function toAdminRequest(db: Database, record: AdminRequestRecord): AdminRequest {
  const account = db.users.find((u) => u.id === record.userId);
  return {
    id: record.id,
    ...(record.schoolId ? { schoolId: record.schoolId } : {}),
    schoolName: record.schoolName,
    district: record.district,
    mascot: record.mascot,
    primaryColor: record.primaryColor,
    secondaryColor: record.secondaryColor,
    name: account?.name ?? "Deleted account",
    email: account?.email ?? "",
    message: record.message,
    status: record.status,
    createdAt: record.createdAt,
    ...(record.decidedAt === undefined ? {} : { decidedAt: record.decidedAt }),
  };
}

function toSchoolSummary(school: Database["schools"][number]): SchoolSummary {
  return {
    id: school.id,
    name: school.name,
    district: school.district,
    mascot: school.mascot,
    primaryColor: school.primaryColor,
    secondaryColor: school.secondaryColor,
  };
}

// -------------------------------------------------------------- authorization

const isActiveStaff = (user: UserRecord) =>
  user.status === "active" && (user.role === "teacher" || user.role === "admin");

const isActiveAdmin = (user: UserRecord) => user.status === "active" && user.role === "admin";

/** Admins run the campus; a teacher only controls the clubs they sponsor. */
function canManage(user: UserRecord, club: ClubRecord): boolean {
  if (!isActiveStaff(user) || user.schoolId !== club.schoolId) return false;
  return user.role === "admin" || club.sponsorId === user.id;
}

function canManageTeam(user: UserRecord, team: TeamRecord): boolean {
  if (!isActiveStaff(user) || user.schoolId !== team.schoolId) return false;
  return user.role === "admin" || team.sponsorId === user.id;
}

/** Every mutation below starts here, so an unapproved account can never write. */
async function requireEnrolled(): Promise<
  { user: UserRecord; error: null } | { user: null; error: string }
> {
  const user = await currentUser();
  if (!user) return { user: null, error: "You're signed out. Sign in and try again." };
  if (!user.emailVerified) return { user: null, error: "Confirm your email address first." };
  if (!user.schoolId) return { user: null, error: "Enter your campus access code first." };
  if (user.role !== "student" && user.status !== "active")
    return { user: null, error: "A school admin hasn't approved this account yet." };
  return { user, error: null };
}

/**
 * The gate on everything only the people running ClubHub may do. It re-reads the
 * environment allowlist rather than trusting anything on the account, so this
 * cannot be reached by editing a record or replaying a stale session.
 */
async function requireOwner(): Promise<
  { user: UserRecord; error: null } | { user: null; error: string }
> {
  const user = await currentUser();
  if (!user) return { user: null, error: "You're signed out. Sign in and try again." };
  if (!user.emailVerified) return { user: null, error: "Confirm your email address first." };
  if (!isOwner(user.email)) return { user: null, error: "Only a ClubHub owner can do that." };
  return { user, error: null };
}

// ----------------------------------------------------------------- read model

export async function loadState(): Promise<AppState> {
  const db = await getDatabase();
  const user = await currentUser();

  // Recovery copies are actual school data, so remove them durably as soon as
  // the grace period has elapsed and the application receives another request.
  if (db.schoolDepartures.some((item) => new Date(item.expiresAt).getTime() <= Date.now())) {
    await transaction((next) => {
      next.schoolDepartures = next.schoolDepartures.filter(
        (item) => new Date(item.expiresAt).getTime() > Date.now(),
      );
    });
  }

  const empty: AppState = {
    user: user ? toSession(user) : null,
    prefs: user?.prefs ?? { ...defaultPrefs },
    school: null,
    clubs: [],
    clubMembers: {},
    teams: [],
    teamMembers: {},
    events: [],
    eventRsvps: [],
    announcements: [],
    tutorialTeachers: [],
    selectedTutorialTeachers: [],
    tutorials: [],
    myClubs: [],
    pending: [],
    requests: [],
    staff: [],
    users: [],
    schoolCode: "",
    schools: [],
    adminRequests: [],
    myAdminRequest: null,
    schoolOptions: [],
    ownersConfigured: ownersConfigured(),
    emailInConsoleMode: emailInConsoleMode(),
    schoolDeparture: null,
  };

  // An unconfirmed address sees nothing but its own status.
  if (!user || !user.emailVerified) return empty;

  const departure = db.schoolDepartures.find(
    (item) => item.userId === user.id && new Date(item.expiresAt).getTime() > Date.now(),
  );
  if (departure) {
    empty.schoolDeparture = {
      schoolName: departure.schoolName,
      expiresAt: departure.expiresAt,
    };
  }

  // Owners work above the schools: the request queue and the campus list, not a
  // club directory. They never belong to a campus themselves.
  if (isOwner(user.email)) {
    return {
      ...empty,
      schools: db.schools.map((school) => ({
        ...toSchoolSummary(school),
        joinCode: school.joinCode,
        admins: db.users.filter(
          (u) => u.schoolId === school.id && u.role === "admin" && u.status === "active",
        ).length,
        students: db.users.filter((u) => u.schoolId === school.id && u.role === "student").length,
        clubs: db.clubs.filter((c) => c.schoolId === school.id).length,
      })),
      adminRequests: db.adminRequests
        .map((record) => toAdminRequest(db, record))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }

  // An admin with no campus is waiting on an owner — give them the school list
  // to pick from and whatever they've already submitted.
  if (user.role === "admin" && !user.schoolId) {
    const mine = db.adminRequests
      .filter((r) => r.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      ...empty,
      schoolOptions: db.schools.map(toSchoolSummary),
      myAdminRequest: mine ? toAdminRequest(db, mine) : null,
    };
  }

  // Signed in, but not through the campus code screen yet.
  const school = db.schools.find((candidate) => candidate.id === user.schoolId);
  if (!school) return empty;
  // Staff waiting on approval can see which campus is reviewing them, but no
  // campus data or management controls.
  if (user.role !== "student" && user.status !== "active") {
    return {
      ...empty,
      school: {
        name: school.name,
        mascot: school.mascot,
        district: school.district,
        primaryColor: school.primaryColor,
        secondaryColor: school.secondaryColor,
      },
    };
  }

  const clubs = db.clubs.filter((c) => c.schoolId === school.id && c.category !== "Athletics");
  const schoolTeams = db.teams.filter((team) => team.schoolId === school.id);
  const joinedTeamIds = new Set(
    db.teamMemberships.filter((member) => member.userId === user.id).map((member) => member.teamId),
  );
  const visibleTeams = schoolTeams.filter((team) =>
    user.role === "admin"
      ? true
      : user.role === "teacher"
        ? team.sponsorId === user.id
        : joinedTeamIds.has(team.id),
  );
  const visibleTeamIds = new Set(visibleTeams.map((team) => team.id));
  const teamMembers = Object.fromEntries(
    visibleTeams.map((team) => [
      team.id,
      db.teamMemberships
        .filter((membership) => membership.teamId === team.id)
        .map((membership) => db.users.find((account) => account.id === membership.userId))
        .filter(
          (account): account is UserRecord =>
            !!account && (account.id === user.id || account.prefs.directoryVisible),
        )
        .map((account) => ({
          id: account.id,
          name: account.name,
          ...(account.grade ? { grade: account.grade } : {}),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ]),
  );
  const mine = db.memberships.filter((m) => m.userId === user.id);
  const myClubIds = mine.filter((m) => m.status === "member").map((m) => m.clubId);

  const manageable = clubs.filter((c) => canManage(user, c));
  const manageableIds = new Set(manageable.map((c) => c.id));
  const schoolClubIds = new Set(clubs.map((club) => club.id));
  const rosterClubIds = new Set([
    ...myClubIds,
    ...manageableIds,
    ...(isActiveAdmin(user) ? clubs.map((club) => club.id) : []),
  ]);
  const clubMembers = Object.fromEntries(
    [...rosterClubIds].map((clubId) => [
      clubId,
      db.memberships
        .filter((membership) => membership.clubId === clubId && membership.status === "member")
        .map((membership) => db.users.find((account) => account.id === membership.userId))
        .filter(
          (account): account is UserRecord =>
            !!account && (account.id === user.id || account.prefs.directoryVisible),
        )
        .map((account) => ({
          id: account.id,
          name: account.name,
          ...(account.grade ? { grade: account.grade } : {}),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ]),
  );

  const visibleAnnouncements = db.announcements.filter((a) => {
    if (a.schoolId) return a.schoolId === school.id;
    if (a.teamId) return visibleTeamIds.has(a.teamId);
    if (!a.clubId || !schoolClubIds.has(a.clubId)) return false;
    if (user.role === "admin") return true;
    return myClubIds.includes(a.clubId) || manageableIds.has(a.clubId);
  });

  const requests: JoinRequest[] = db.memberships
    .filter((m) => m.status === "pending" && manageableIds.has(m.clubId))
    .map((m) => {
      const student = db.users.find((u) => u.id === m.userId);
      return {
        id: m.id,
        clubId: m.clubId,
        studentName: student?.name ?? "Unknown student",
        email: student?.email ?? "",
        grade: student?.grade ?? "—",
        note: m.note,
      };
    });

  const staff: StaffAccount[] = isActiveAdmin(user)
    ? db.users
        .filter((u) => u.schoolId === school.id && (u.role === "teacher" || u.role === "admin"))
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          ...(u.department === undefined ? {} : { department: u.department }),
          ...(u.note === undefined ? {} : { note: u.note }),
        }))
    : [];

  const users: SchoolAccount[] = isActiveAdmin(user)
    ? db.users
        .filter((account) => account.schoolId === school.id)
        .map((account) => ({
          id: account.id,
          name: account.name,
          email: account.email,
          role: account.role,
          status: account.status,
          ...(account.grade === undefined ? {} : { grade: account.grade }),
        }))
    : [];

  const visibleEvents = db.events.filter((event) =>
    event.teamId
      ? visibleTeamIds.has(event.teamId)
      : clubs.some((club) => club.id === event.clubId),
  );
  const visibleEventIds = new Set(visibleEvents.map((event) => event.id));
  const tutorialTeachers: TutorialTeacher[] = db.users
    .filter(
      (account) =>
        account.schoolId === school.id && account.role === "teacher" && account.status === "active",
    )
    .map((account) => ({
      id: account.id,
      name: account.name,
      email: account.email,
      ...(account.department ? { department: account.department } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedTutorialTeachers = db.tutorialTeachers
    .filter((selection) => selection.studentId === user.id)
    .map((selection) => selection.teacherId);
  const visibleTutorialTeacherIds = new Set(
    user.role === "admin"
      ? tutorialTeachers.map((teacher) => teacher.id)
      : user.role === "teacher"
        ? [user.id]
        : selectedTutorialTeachers,
  );
  const startDate = new Date(`${today()}T12:00:00`);
  const dates = Array.from({ length: 43 }, (_, offset) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  });
  const tutorials: TutorialOccurrence[] = db.tutorialSchedules
    .filter(
      (schedule) =>
        schedule.schoolId === school.id && visibleTutorialTeacherIds.has(schedule.teacherId),
    )
    .flatMap((schedule) => {
      const occurrenceDates = schedule.recurring
        ? dates.filter((date) => new Date(`${date}T12:00:00`).getDay() === schedule.weekday)
        : schedule.date && schedule.date >= today() && dates.includes(schedule.date)
          ? [schedule.date]
          : [];
      return occurrenceDates.map((date) => {
        const signups = db.tutorialSignups.filter(
          (signup) => signup.scheduleId === schedule.id && signup.date === date,
        );
        const teacher = db.users.find((account) => account.id === schedule.teacherId);
        return {
          id: `${schedule.id}:${date}`,
          scheduleId: schedule.id,
          teacherId: schedule.teacherId,
          teacherName: teacher?.name ?? "Teacher",
          date,
          start: schedule.start,
          end: schedule.end,
          location: schedule.location,
          recurring: schedule.recurring,
          cancelled: db.tutorialCancellations.some(
            (item) => item.scheduleId === schedule.id && item.date === date,
          ),
          signupCount: signups.length,
          signedUp: signups.some((signup) => signup.studentId === user.id),
          ...(user.role === "teacher" && schedule.teacherId === user.id
            ? {
                studentNames: signups
                  .map(
                    (signup) => db.users.find((account) => account.id === signup.studentId)?.name,
                  )
                  .filter((name): name is string => !!name)
                  .sort((a, b) => a.localeCompare(b)),
              }
            : {}),
        };
      });
    })
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));

  return {
    ...empty,
    user: toSession(user),
    prefs: user.prefs,
    school: {
      name: school.name,
      mascot: school.mascot,
      district: school.district,
      primaryColor: school.primaryColor,
      secondaryColor: school.secondaryColor,
    },
    clubs: clubs.map((c) => toClub(db, c)),
    clubMembers,
    teams: visibleTeams.map((team) => toTeam(db, team, user)),
    teamMembers,
    events: visibleEvents,
    eventRsvps: db.eventRsvps
      .filter((rsvp) => visibleEventIds.has(rsvp.eventId))
      .map((rsvp) => ({
        eventId: rsvp.eventId,
        userId: rsvp.userId,
        name: db.users.find((account) => account.id === rsvp.userId)?.name ?? "Former student",
        status: rsvp.status,
      })),
    announcements: visibleAnnouncements
      .map((a) => ({
        id: a.id,
        ...(a.schoolId ? { schoolWide: true } : {}),
        ...(a.clubId ? { clubId: a.clubId } : {}),
        ...(a.teamId ? { teamId: a.teamId } : {}),
        title: a.title,
        body: a.body,
        author: db.users.find((u) => u.id === a.authorId)?.name ?? "Sponsor",
        postedAt: a.postedAt,
      }))
      .sort((a, b) => b.postedAt.localeCompare(a.postedAt)),
    tutorialTeachers,
    selectedTutorialTeachers,
    tutorials,
    myClubs: myClubIds,
    pending: mine.filter((m) => m.status === "pending").map((m) => m.clubId),
    requests,
    staff,
    users,
    schoolCode: isActiveAdmin(user) ? school.joinCode : "",
  };
}

// ---------------------------------------------------------------------- teams

function generateTeamCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return `TEAM-${String((bytes[0] ?? 0) % 1_000_000).padStart(6, "0")}`;
}

export async function createTeam(input: { name: string; sport: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (!isActiveStaff(user)) return fail("Only approved staff can create a team.");
  const name = input.name.trim();
  const sport = input.sport.trim();
  if (name.length < 2) return fail("Enter the team name.");
  if (sport.length < 2) return fail("Enter the sport or activity.");

  return transaction((db) => {
    if (db.teams.some((team) => team.schoolId === user.schoolId && norm(team.name) === norm(name)))
      return fail("A team with that name already exists at your school.");
    let joinCode = generateTeamCode();
    while (db.teams.some((team) => norm(team.joinCode) === norm(joinCode)))
      joinCode = generateTeamCode();
    db.teams.push({
      id: newId("team"),
      schoolId: user.schoolId!,
      name,
      sport,
      sponsorId: user.id,
      joinCode,
      createdAt: new Date().toISOString(),
    });
    return ok;
  });
}

export async function joinTeam(input: { code: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (user.role !== "student") return fail("Only student accounts join teams with a code.");
  const code = norm(input.code);
  return transaction((db) => {
    const team = db.teams.find(
      (candidate) => candidate.schoolId === user.schoolId && norm(candidate.joinCode) === code,
    );
    if (!team) return fail("That team code isn't valid for your school.");
    if (db.teamMemberships.some((member) => member.teamId === team.id && member.userId === user.id))
      return ok;
    db.teamMemberships.push({
      id: newId("tm"),
      teamId: team.id,
      userId: user.id,
      createdAt: new Date().toISOString(),
    });
    return ok;
  });
}

// --------------------------------------------------------------------- access

export async function signUp(input: {
  name: string;
  email: string;
  role: Role;
  grade: string;
  password: string;
  schoolCode: string;
}): Promise<Result> {
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return fail("Enter your full name.");

  const roles: Role[] = ["student", "teacher", "admin"];
  if (!roles.includes(input.role)) return fail("Pick a role.");

  // Owners and the bootstrap admin are named in the environment rather than by a
  // school mailbox, so the campus domain rules don't apply to them.
  const privileged = isOwner(email) || isBootstrapAdmin(email);
  if (!privileged) {
    const emailError = emailProblem(email, input.role);
    if (emailError) return fail(emailError);
  }

  const passwordError = passwordProblem(input.password);
  if (passwordError) return fail(passwordError);

  const signupDb = await getDatabase();
  const selectedSchool =
    (input.role === "student" || input.role === "teacher") && !privileged
      ? signupDb.schools.find((school) => norm(school.joinCode) === norm(input.schoolCode))
      : null;
  if ((input.role === "student" || input.role === "teacher") && !privileged && !selectedSchool)
    return fail("Enter the school code your school gave you.");

  const passwordHash = await hashPassword(input.password);

  const created = await transaction((db) => {
    if (db.users.some((u) => norm(u.email) === norm(email))) return null;

    // The bootstrap admin skips the request queue and lands on the default
    // campus already active — that's the point of the variable.
    const bootstrap = isBootstrapAdmin(email);
    const defaultSchool =
      db.schools.find((s) => s.id === FRISCO_SCHOOL_ID) ?? db.schools[0] ?? null;

    const user: UserRecord = {
      id: newId("usr"),
      name,
      email,
      role: bootstrap ? "admin" : input.role,
      // Staff wait: teachers on a school admin, admins on a ClubHub owner.
      // Students are in as soon as they have the campus code.
      status: input.role === "student" || privileged ? "active" : "pending",
      passwordHash,
      emailVerified: false,
      schoolId: bootstrap ? (defaultSchool?.id ?? null) : (selectedSchool?.id ?? null),
      ...(input.role === "student" && input.grade ? { grade: input.grade } : {}),
      prefs: { ...defaultPrefs },
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    return user;
  });

  if (!created) return fail("An account with that email already exists. Sign in instead.");
  await startSession(created.id);
  // The account exists either way; a delivery failure is recoverable from the
  // confirmation screen's resend button.
  return issueVerificationCode(created);
}

// --------------------------------------------------------- email verification

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_CODE_ATTEMPTS = 5;

function sixDigitCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(100000 + ((bytes[0] ?? 0) % 900000));
}

/** Mails a fresh code and replaces whatever was outstanding for the account. */
async function issueVerificationCode(user: UserRecord): Promise<Result> {
  const code = sixDigitCode();
  const codeHash = await hashToken(code);

  try {
    await sendVerificationCode(user.email, code);
  } catch (error) {
    console.error("[clubhub] Verification email failed", error);
    return fail("We couldn't send the confirmation email. Try again in a moment.");
  }

  await transaction((db) => {
    db.emailVerifications = db.emailVerifications.filter((item) => item.userId !== user.id);
    db.emailVerifications.push({
      userId: user.id,
      email: norm(user.email),
      codeHash,
      expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      sentAt: new Date().toISOString(),
      attempts: 0,
    });
  });
  return ok;
}

export async function resendVerification(): Promise<Result> {
  const user = await currentUser();
  if (!user) return fail("You're signed out. Sign in and try again.");
  if (user.emailVerified) return ok;

  const existing = (await getDatabase()).emailVerifications.find((i) => i.userId === user.id);
  if (existing && Date.now() - Date.parse(existing.sentAt) < RESEND_COOLDOWN_MS)
    return fail("Wait a minute before asking for another code.");

  return issueVerificationCode(user);
}

export async function verifyEmail(input: { code: string }): Promise<Result> {
  const user = await currentUser();
  if (!user) return fail("You're signed out. Sign in and try again.");
  if (user.emailVerified) return ok;

  const codeHash = await hashToken(input.code.trim());

  return transaction((db) => {
    const record = db.emailVerifications.find((item) => item.userId === user.id);
    if (!record) return fail("That code expired. Ask for a new one.");
    if (record.email !== norm(user.email)) return fail("Your email changed. Ask for a new code.");
    if (Date.parse(record.expiresAt) < Date.now())
      return fail("That code expired. Ask for a new one.");
    if (record.attempts >= MAX_CODE_ATTEMPTS) return fail("Too many tries. Ask for a new code.");

    record.attempts += 1;
    if (codeHash !== record.codeHash) return fail("That code isn't right.");

    const account = db.users.find((u) => u.id === user.id);
    if (!account) return fail("Account not found.");
    account.emailVerified = true;
    db.emailVerifications = db.emailVerifications.filter((item) => item.userId !== user.id);
    return ok;
  });
}

export async function signIn(input: { email: string; password: string }): Promise<Result> {
  const key = norm(input.email);
  if (throttled(key)) return fail("Too many failed attempts. Wait 15 minutes and try again.");

  const db = await getDatabase();
  const user = db.users.find((u) => norm(u.email) === key);

  if (!user) {
    recordFailure(key);
    // Spend the same work as a real verification so timing doesn't reveal much.
    await hashPassword(input.password);
    return fail(BAD_CREDENTIALS);
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    recordFailure(key);
    return fail(BAD_CREDENTIALS);
  }

  clearFailures(key);
  await startSession(user.id);
  return ok;
}

export async function signOut(): Promise<Result> {
  await endSession();
  return ok;
}

export async function joinSchool(input: { code: string }): Promise<Result> {
  const user = await currentUser();
  if (!user) return fail("You're signed out. Sign in and try again.");
  if (!user.emailVerified) return fail("Confirm your email address first.");
  if (user.role === "admin")
    return fail("School admins receive a campus when a ClubHub owner approves their application.");
  const transferringAfterRevocation = user.role === "teacher" && user.status === "denied";
  if (user.schoolId && !transferringAfterRevocation)
    return fail("Your account already belongs to a campus.");

  const db = await getDatabase();
  const school = db.schools.find((candidate) => norm(candidate.joinCode) === norm(input.code));
  if (!school)
    return fail("That code doesn't match a campus. Ask your sponsor for the current one.");

  await transaction((next) => {
    const record = next.users.find((u) => u.id === user.id);
    if (record) {
      record.schoolId = school.id;
      if (record.role === "teacher") record.status = "pending";
      // Joining another campus confirms the transfer and makes the old campus
      // snapshot unrecoverable before the normal 14-day expiry.
      next.schoolDepartures = next.schoolDepartures.filter((item) => item.userId !== user.id);
    }
  });
  return ok;
}

export async function leaveSchool(input: { password: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (user.role === "admin")
    return fail("School admins must transfer campus ownership instead of leaving a school.");
  if (!(await verifyPassword(input.password, user.passwordHash)))
    return fail("That password doesn't match your account.");

  const result = await transaction((db): Result => {
    const record = db.users.find((candidate) => candidate.id === user.id);
    if (!record?.schoolId) return fail("Your account doesn't currently belong to a campus.");

    const oldSchoolId = record.schoolId;
    const oldSchool = db.schools.find((school) => school.id === oldSchoolId);
    if (!oldSchool) return fail("Your current school could not be found.");
    const sponsoredClubs = db.clubs.filter((club) => club.sponsorId === user.id);
    const sponsoredTeams = db.teams.filter((team) => team.sponsorId === user.id);
    const replacementAdmin = db.users.find(
      (candidate) =>
        candidate.schoolId === oldSchoolId &&
        candidate.role === "admin" &&
        candidate.status === "active",
    );

    if ((sponsoredClubs.length > 0 || sponsoredTeams.length > 0) && !replacementAdmin)
      return fail(
        "Your sponsored clubs and teams need an active school admin before you can leave.",
      );

    if (replacementAdmin) {
      sponsoredClubs.forEach((club) => {
        club.sponsorId = replacementAdmin.id;
      });
      sponsoredTeams.forEach((team) => {
        team.sponsorId = replacementAdmin.id;
      });
    }

    const memberships = db.memberships.filter((membership) => membership.userId === user.id);
    const teamMemberships = db.teamMemberships.filter(
      (membership) => membership.userId === user.id,
    );
    const eventRsvps = db.eventRsvps.filter((rsvp) => rsvp.userId === user.id);

    const tutorialScheduleIds = new Set(
      db.tutorialSchedules
        .filter((schedule) => schedule.teacherId === user.id)
        .map((schedule) => schedule.id),
    );
    const tutorialSchedules = db.tutorialSchedules.filter(
      (schedule) => schedule.teacherId === user.id,
    );
    const tutorialCancellations = db.tutorialCancellations.filter((cancellation) =>
      tutorialScheduleIds.has(cancellation.scheduleId),
    );
    const tutorialTeachers = db.tutorialTeachers.filter(
      (selection) => selection.studentId === user.id || selection.teacherId === user.id,
    );
    const tutorialSignups = db.tutorialSignups.filter(
      (signup) => signup.studentId === user.id || tutorialScheduleIds.has(signup.scheduleId),
    );

    const leftAt = new Date();
    const expiresAt = new Date(leftAt);
    expiresAt.setDate(expiresAt.getDate() + 14);
    db.schoolDepartures = db.schoolDepartures.filter((item) => item.userId !== user.id);
    db.schoolDepartures.push({
      userId: user.id,
      schoolId: oldSchoolId,
      schoolName: oldSchool.name,
      previousStatus: record.status,
      leftAt: leftAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      memberships,
      teamMemberships,
      eventRsvps,
      tutorialSchedules,
      tutorialCancellations,
      tutorialTeachers,
      tutorialSignups,
      sponsoredClubIds: sponsoredClubs.map((club) => club.id),
      sponsoredTeamIds: sponsoredTeams.map((team) => team.id),
    });

    db.memberships = db.memberships.filter((membership) => membership.userId !== user.id);
    db.teamMemberships = db.teamMemberships.filter((membership) => membership.userId !== user.id);
    db.eventRsvps = db.eventRsvps.filter((rsvp) => rsvp.userId !== user.id);
    db.tutorialSchedules = db.tutorialSchedules.filter(
      (schedule) => schedule.teacherId !== user.id,
    );
    db.tutorialCancellations = db.tutorialCancellations.filter(
      (cancellation) => !tutorialScheduleIds.has(cancellation.scheduleId),
    );
    db.tutorialTeachers = db.tutorialTeachers.filter(
      (selection) => selection.studentId !== user.id && selection.teacherId !== user.id,
    );
    db.tutorialSignups = db.tutorialSignups.filter(
      (signup) => signup.studentId !== user.id && !tutorialScheduleIds.has(signup.scheduleId),
    );

    record.schoolId = null;
    if (record.role === "teacher") record.status = "pending";
    return ok;
  });

  return result;
}

export async function undoLeaveSchool(): Promise<Result> {
  const user = await currentUser();
  if (!user) return fail("You're signed out. Sign in and try again.");
  if (user.schoolId) return fail("Leave your current school before restoring the previous one.");

  return transaction((db): Result => {
    const departure = db.schoolDepartures.find((item) => item.userId === user.id);
    if (!departure) return fail("There is no school transfer to undo.");
    if (new Date(departure.expiresAt).getTime() <= Date.now()) {
      db.schoolDepartures = db.schoolDepartures.filter((item) => item.userId !== user.id);
      return fail("The 14-day recovery period has ended and that school data is gone forever.");
    }
    if (!db.schools.some((school) => school.id === departure.schoolId))
      return fail("That school no longer exists.");

    const record = db.users.find((candidate) => candidate.id === user.id);
    if (!record) return fail("Your account could not be found.");
    record.schoolId = departure.schoolId;
    record.status = departure.previousStatus;

    const appendUnique = <T>(current: T[], restored: T[], key: (item: T) => string) => {
      const existing = new Set(current.map(key));
      return [...current, ...restored.filter((item) => !existing.has(key(item)))];
    };
    db.memberships = appendUnique(db.memberships, departure.memberships, (item) => item.id);
    db.teamMemberships = appendUnique(
      db.teamMemberships,
      departure.teamMemberships,
      (item) => item.id,
    );
    db.eventRsvps = appendUnique(
      db.eventRsvps,
      departure.eventRsvps,
      (item) => `${item.eventId}:${item.userId}`,
    );
    db.tutorialSchedules = appendUnique(
      db.tutorialSchedules,
      departure.tutorialSchedules,
      (item) => item.id,
    );
    db.tutorialCancellations = appendUnique(
      db.tutorialCancellations,
      departure.tutorialCancellations,
      (item) => `${item.scheduleId}:${item.date}`,
    );
    db.tutorialTeachers = appendUnique(
      db.tutorialTeachers,
      departure.tutorialTeachers,
      (item) => `${item.studentId}:${item.teacherId}`,
    );
    db.tutorialSignups = appendUnique(
      db.tutorialSignups,
      departure.tutorialSignups,
      (item) => `${item.scheduleId}:${item.date}:${item.studentId}`,
    );

    for (const club of db.clubs.filter((item) => departure.sponsoredClubIds.includes(item.id))) {
      const sponsor = db.users.find((candidate) => candidate.id === club.sponsorId);
      if (sponsor?.role === "admin") club.sponsorId = user.id;
    }
    for (const team of db.teams.filter((item) => departure.sponsoredTeamIds.includes(item.id))) {
      const sponsor = db.users.find((candidate) => candidate.id === team.sponsorId);
      if (sponsor?.role === "admin") team.sponsorId = user.id;
    }

    db.schoolDepartures = db.schoolDepartures.filter((item) => item.userId !== user.id);
    return ok;
  });
}

// ------------------------------------------------------- owner administration

type SchoolSetupInput = {
  name: string;
  mascot: string;
  district: string;
  primaryColor: string;
  secondaryColor: string;
};

const validHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value.trim());

function validateSchoolSetup(input: SchoolSetupInput): string | null {
  if (input.name.trim().length < 3) return "Enter the full school name.";
  if (input.district.trim().length < 2) return "Enter the school district or organization.";
  if (input.mascot.trim().length < 2) return "Enter the school mascot.";
  if (!validHexColor(input.primaryColor) || !validHexColor(input.secondaryColor))
    return "Choose two valid school colors.";
  return null;
}

function schoolCode(name: string): string {
  const prefix =
    name
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 5)
      .toUpperCase() || "SCHOOL";
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return `${prefix}-${String((bytes[0] ?? 0) % 10000).padStart(4, "0")}`;
}

export type CreateSchoolResult = Result & { joinCode?: string };

/**
 * Only a ClubHub owner adds a campus. Nobody can sign up and hand themselves a
 * school any more — that was the same thing as handing yourself an admin
 * account.
 */
export async function createSchool(input: SchoolSetupInput): Promise<CreateSchoolResult> {
  const { user, error } = await requireOwner();
  if (!user) return fail(error);

  const problem = validateSchoolSetup(input);
  if (problem) return fail(problem);

  return transaction((db): CreateSchoolResult => {
    const name = input.name.trim();
    if (db.schools.some((school) => norm(school.name) === norm(name)))
      return fail("A school with that name already exists.");

    let joinCode = schoolCode(name);
    while (db.schools.some((school) => norm(school.joinCode) === norm(joinCode)))
      joinCode = schoolCode(name);

    db.schools.push({
      id: newId("sch"),
      name,
      mascot: input.mascot.trim(),
      district: input.district.trim(),
      joinCode,
      primaryColor: input.primaryColor.trim().toLowerCase(),
      secondaryColor: input.secondaryColor.trim().toLowerCase(),
    });
    return { error: null, joinCode };
  });
}

/**
 * How somebody becomes a school admin: they ask, and an owner decides. The
 * request carries no privilege on its own — approval is what moves the account
 * onto a campus.
 */
export async function requestAdmin(input: SchoolSetupInput & { message: string }): Promise<Result> {
  const user = await currentUser();
  if (!user) return fail("You're signed out. Sign in and try again.");
  if (!user.emailVerified) return fail("Confirm your email address first.");
  if (user.role !== "admin")
    return fail("Only an account created as a school admin can request a campus.");
  if (user.schoolId) return fail("Your account already runs a campus.");

  const message = input.message.trim();
  const setupProblem = validateSchoolSetup(input);
  if (setupProblem) return fail(setupProblem);
  if (message.length < 20)
    return fail(
      "Tell us who you are at the school and why you should run it — at least a sentence.",
    );

  return transaction((db) => {
    if (db.schools.some((school) => norm(school.name) === norm(input.name)))
      return fail("That school is already on ClubHub. New applications must be for a new school.");
    if (
      db.adminRequests.some(
        (request) => request.status === "pending" && norm(request.schoolName) === norm(input.name),
      )
    )
      return fail("An application for that school is already waiting for review.");
    if (db.adminRequests.some((r) => r.userId === user.id && r.status === "pending"))
      return fail("You already have a request waiting on a ClubHub owner.");

    db.adminRequests.push({
      id: newId("adm"),
      userId: user.id,
      schoolName: input.name.trim(),
      district: input.district.trim(),
      mascot: input.mascot.trim(),
      primaryColor: input.primaryColor.trim().toLowerCase(),
      secondaryColor: input.secondaryColor.trim().toLowerCase(),
      message: message.slice(0, 1000),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    return ok;
  });
}

export async function reviewAdminRequest(input: { id: string; approve: boolean }): Promise<Result> {
  const { user, error } = await requireOwner();
  if (!user) return fail(error);

  return transaction((db) => {
    const request = db.adminRequests.find((r) => r.id === input.id);
    if (!request) return fail("That request no longer exists.");
    if (request.status !== "pending") return fail("That request was already decided.");

    const account = db.users.find((u) => u.id === request.userId);
    if (!account) return fail("That account was deleted.");
    if (
      input.approve &&
      db.schools.some((school) => norm(school.name) === norm(request.schoolName))
    )
      return fail("That school was created while this request was waiting.");
    request.status = input.approve ? "approved" : "denied";
    request.decidedAt = new Date().toISOString();
    request.decidedBy = user.id;

    if (input.approve) {
      let joinCode = schoolCode(request.schoolName);
      while (db.schools.some((school) => norm(school.joinCode) === norm(joinCode)))
        joinCode = schoolCode(request.schoolName);
      const schoolId = newId("sch");
      db.schools.push({
        id: schoolId,
        name: request.schoolName,
        district: request.district,
        mascot: request.mascot,
        primaryColor: request.primaryColor,
        secondaryColor: request.secondaryColor,
        joinCode,
      });
      request.schoolId = schoolId;
      account.role = "admin";
      account.status = "active";
      account.schoolId = schoolId;
    } else {
      account.status = "denied";
      // A rejected applicant shouldn't keep a live session.
      db.sessions = db.sessions.filter((s) => s.userId !== account.id);
    }
    return ok;
  });
}

/** Takes a campus away from an admin without deleting their account. */
export async function revokeAdmin(input: { userId: string }): Promise<Result> {
  const { user, error } = await requireOwner();
  if (!user) return fail(error);

  return transaction((db) => {
    const account = db.users.find((u) => u.id === input.userId);
    if (!account) return fail("That account no longer exists.");
    if (account.role !== "admin") return fail("That account isn't a school admin.");
    if (isOwner(account.email)) return fail("Owners are set in the environment, not here.");
    if (
      account.schoolId &&
      db.users.filter(
        (candidate) =>
          candidate.schoolId === account.schoolId &&
          candidate.role === "admin" &&
          candidate.status === "active",
      ).length <= 1
    )
      return fail("Approve another admin for this school before revoking its only administrator.");

    account.status = "denied";
    account.schoolId = null;
    db.sessions = db.sessions.filter((s) => s.userId !== account.id);
    return ok;
  });
}

// -------------------------------------------------------------------- account

export async function updateProfile(input: {
  name: string;
  email: string;
  grade: string;
}): Promise<Result> {
  const user = await currentUser();
  if (!user) return fail("You're signed out. Sign in and try again.");

  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return fail("Name can't be empty.");
  if (user.role === "student" && !GRADES.includes(input.grade as (typeof GRADES)[number]))
    return fail("Choose a valid grade.");

  if (!isOwner(email) && !isBootstrapAdmin(email)) {
    const emailError = emailProblem(email, user.role);
    if (emailError) return fail(emailError);
  }

  const changedEmail = norm(email) !== norm(user.email);

  const result = await transaction((db) => {
    if (db.users.some((u) => u.id !== user.id && norm(u.email) === norm(email)))
      return fail("Another account already uses that email.");
    const record = db.users.find((u) => u.id === user.id);
    if (!record) return fail("Account not found.");
    record.name = name;
    record.email = email;
    if (record.role === "student") record.grade = input.grade;
    // A new address is unproven, whatever the old one was.
    if (changedEmail) {
      record.emailVerified = false;
      db.emailVerifications = db.emailVerifications.filter((item) => item.userId !== user.id);
    }
    return ok;
  });

  if (result.error || !changedEmail) return result;
  return issueVerificationCode({ ...user, email });
}

export async function changePassword(input: {
  current: string;
  next: string;
  confirm: string;
}): Promise<Result> {
  const user = await currentUser();
  if (!user) return fail("You're signed out. Sign in and try again.");

  if (!(await verifyPassword(input.current, user.passwordHash)))
    return fail("Current password is incorrect.");

  const problem = passwordProblem(input.next);
  if (problem) return fail(problem);
  if (input.next !== input.confirm) return fail("New passwords don't match.");

  const passwordHash = await hashPassword(input.next);
  await transaction((db) => {
    const record = db.users.find((u) => u.id === user.id);
    if (record) record.passwordHash = passwordHash;
  });

  // Changing a password should log out anything holding the old session.
  await endAllSessions(user.id);
  await startSession(user.id);
  return ok;
}

export async function updatePref(input: { key: keyof Prefs; value: boolean }): Promise<Result> {
  const user = await currentUser();
  if (!user) return fail("You're signed out. Sign in and try again.");
  if (!(input.key in defaultPrefs)) return fail("Unknown preference.");

  await transaction((db) => {
    const record = db.users.find((u) => u.id === user.id);
    if (record) record.prefs = { ...record.prefs, [input.key]: input.value };
  });
  return ok;
}

export async function deleteAccount(): Promise<Result> {
  const user = await currentUser();
  if (!user) return fail("You're signed out. Sign in and try again.");

  const onlyAdminBlock = "__only_school_admin__";
  const sponsored = await transaction((db) => {
    if (
      user.role === "admin" &&
      user.status === "active" &&
      user.schoolId &&
      db.users.filter(
        (candidate) =>
          candidate.schoolId === user.schoolId &&
          candidate.role === "admin" &&
          candidate.status === "active",
      ).length <= 1
    ) {
      return [onlyAdminBlock];
    }
    const owns = [
      ...db.clubs.filter((club) => club.sponsorId === user.id).map((club) => club.name),
      ...db.teams.filter((team) => team.sponsorId === user.id).map((team) => team.name),
    ];
    if (owns.length > 0) return owns;

    db.users = db.users.filter((u) => u.id !== user.id);
    db.memberships = db.memberships.filter((m) => m.userId !== user.id);
    db.teamMemberships = db.teamMemberships.filter((membership) => membership.userId !== user.id);
    db.eventRsvps = db.eventRsvps.filter((rsvp) => rsvp.userId !== user.id);
    const tutorialScheduleIds = new Set(
      db.tutorialSchedules
        .filter((schedule) => schedule.teacherId === user.id)
        .map((schedule) => schedule.id),
    );
    db.tutorialSchedules = db.tutorialSchedules.filter(
      (schedule) => schedule.teacherId !== user.id,
    );
    db.tutorialCancellations = db.tutorialCancellations.filter(
      (item) => !tutorialScheduleIds.has(item.scheduleId),
    );
    db.tutorialTeachers = db.tutorialTeachers.filter(
      (item) => item.studentId !== user.id && item.teacherId !== user.id,
    );
    db.tutorialSignups = db.tutorialSignups.filter(
      (item) => item.studentId !== user.id && !tutorialScheduleIds.has(item.scheduleId),
    );
    db.sessions = db.sessions.filter((s) => s.userId !== user.id);
    db.emailVerifications = db.emailVerifications.filter((item) => item.userId !== user.id);
    db.adminRequests = db.adminRequests.filter((request) => request.userId !== user.id);
    db.schoolDepartures = db.schoolDepartures.filter((departure) => departure.userId !== user.id);
    return [];
  });

  if (sponsored.includes(onlyAdminBlock))
    return fail(
      "Approve another school admin before deleting the campus's only administrator account.",
    );
  if (sponsored.length > 0)
    return fail(
      `Hand ${sponsored.join(", ")} to another sponsor before deleting your account — a school admin can reassign it.`,
    );

  await endSession();
  return ok;
}

// ----------------------------------------------------------------- membership

export async function joinClub(input: { clubId: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);

  return transaction((db) => {
    const club = db.clubs.find((c) => c.id === input.clubId && c.schoolId === user.schoolId);
    if (!club) return fail("That club no longer exists.");
    if (club.visibility !== "public") return fail("This club is private — send a request instead.");
    if (db.memberships.some((m) => m.clubId === club.id && m.userId === user.id)) return ok;

    db.memberships.push({
      id: newId("mem"),
      clubId: club.id,
      userId: user.id,
      status: "member",
      note: "",
      createdAt: new Date().toISOString(),
    });
    return ok;
  });
}

export async function requestClub(input: { clubId: string; note: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);

  return transaction((db) => {
    const club = db.clubs.find((c) => c.id === input.clubId && c.schoolId === user.schoolId);
    if (!club) return fail("That club no longer exists.");
    if (db.memberships.some((m) => m.clubId === club.id && m.userId === user.id)) return ok;

    db.memberships.push({
      id: newId("mem"),
      clubId: club.id,
      userId: user.id,
      status: "pending",
      note: input.note.trim().slice(0, 400),
      createdAt: new Date().toISOString(),
    });
    return ok;
  });
}

export async function leaveClub(input: { clubId: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);

  await transaction((db) => {
    db.memberships = db.memberships.filter(
      (m) => !(m.clubId === input.clubId && m.userId === user.id),
    );
  });
  return ok;
}

export async function reviewMembership(input: { id: string; approve: boolean }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);

  return transaction((db) => {
    const membership = db.memberships.find((m) => m.id === input.id);
    if (!membership) return fail("That request was already handled.");
    const club = db.clubs.find((c) => c.id === membership.clubId);
    if (!club || !canManage(user, club)) return fail("You don't sponsor that club.");

    if (input.approve) membership.status = "member";
    else db.memberships = db.memberships.filter((m) => m.id !== input.id);
    return ok;
  });
}

// ---------------------------------------------------------------------- clubs

export type ClubInput = {
  name: string;
  category: ClubCategory;
  visibility: "public" | "private";
  room: string;
  schedule: MeetingSchedule;
  blurb: string;
  logo: string;
  joinInstructions: string;
  /** Admins may hand a new club straight to a sponsor; teachers always get themselves. */
  sponsorId?: string;
};

function validateClubInput(input: ClubInput): string | null {
  if (!input.name.trim()) return "Give the club a name.";
  if (input.name.trim().length > 80) return "Club names have to be under 80 characters.";
  if (!CATEGORIES.includes(input.category)) return "Pick a category.";
  if (input.visibility !== "public" && input.visibility !== "private") return "Pick who can join.";
  if (!input.room.trim()) return "Add a room so students know where to show up.";
  if (input.logo && !/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(input.logo))
    return "Upload a PNG, JPEG, WebP, or GIF logo.";
  if (input.logo.length > 450_000) return "The club logo must be smaller than 330 KB.";
  return null;
}

export async function createClub(input: ClubInput): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (!isActiveStaff(user)) return fail("Only sponsors and admins can create clubs.");

  const problem = validateClubInput(input);
  if (problem) return fail(problem);

  return transaction((db) => {
    if (db.clubs.some((c) => c.schoolId === user.schoolId && norm(c.name) === norm(input.name)))
      return fail("A club with that name already exists on campus.");

    // Only an admin gets to name someone else as sponsor.
    let sponsorId = user.id;
    if (user.role === "admin" && input.sponsorId) {
      const sponsor = db.users.find((u) => u.id === input.sponsorId);
      if (!sponsor || sponsor.schoolId !== user.schoolId || !isActiveStaff(sponsor))
        return fail("Pick an approved sponsor for this club.");
      sponsorId = sponsor.id;
    }

    db.clubs.push({
      id: newId("clb"),
      schoolId: user.schoolId!,
      name: input.name.trim(),
      category: input.category,
      visibility: input.visibility,
      sponsorId,
      room: input.room.trim(),
      schedule: normalizeSchedule(input.schedule),
      blurb: input.blurb.trim(),
      ...(input.logo ? { logo: input.logo } : {}),
      ...(input.joinInstructions.trim() ? { joinInstructions: input.joinInstructions.trim() } : {}),
      createdAt: new Date().toISOString(),
    });
    return ok;
  });
}

export async function updateClub(input: {
  id: string;
  patch: Partial<ClubInput>;
}): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);

  return transaction((db) => {
    const club = db.clubs.find((c) => c.id === input.id);
    if (!club) return fail("That club no longer exists.");
    if (!canManage(user, club)) return fail("You don't sponsor that club.");

    const { patch } = input;

    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) return fail("Give the club a name.");
      if (name.length > 80) return fail("Club names have to be under 80 characters.");
      if (
        db.clubs.some(
          (c) => c.id !== club.id && c.schoolId === club.schoolId && norm(c.name) === norm(name),
        )
      )
        return fail("A club with that name already exists on campus.");
      club.name = name;
    }
    if (patch.category !== undefined) {
      if (!CATEGORIES.includes(patch.category)) return fail("Pick a category.");
      club.category = patch.category;
    }
    if (patch.visibility !== undefined) {
      if (patch.visibility !== "public" && patch.visibility !== "private")
        return fail("Pick who can join.");
      club.visibility = patch.visibility;
    }
    if (patch.room !== undefined) {
      const room = patch.room.trim();
      if (!room) return fail("Add a room so students know where to show up.");
      club.room = room;
    }
    if (patch.schedule !== undefined) club.schedule = normalizeSchedule(patch.schedule);
    if (patch.blurb !== undefined) club.blurb = patch.blurb.trim();
    if (patch.logo !== undefined) {
      if (
        patch.logo &&
        !/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(patch.logo)
      )
        return fail("Upload a PNG, JPEG, WebP, or GIF logo.");
      if (patch.logo.length > 450_000) return fail("The club logo must be smaller than 330 KB.");
      if (patch.logo) club.logo = patch.logo;
      else delete club.logo;
    }
    if (patch.joinInstructions !== undefined) {
      const text = patch.joinInstructions.trim();
      if (text) club.joinInstructions = text;
      else delete club.joinInstructions;
    }
    if (patch.sponsorId !== undefined && patch.sponsorId !== club.sponsorId) {
      if (user.role !== "admin") return fail("Only a school admin can reassign a sponsor.");
      const sponsor = db.users.find((u) => u.id === patch.sponsorId);
      if (!sponsor || sponsor.schoolId !== user.schoolId || !isActiveStaff(sponsor))
        return fail("Pick an approved sponsor.");
      club.sponsorId = sponsor.id;
    }
    return ok;
  });
}

export async function deleteClub(input: { id: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);

  return transaction((db) => {
    const club = db.clubs.find((c) => c.id === input.id);
    if (!club) return ok;
    if (!canManage(user, club)) return fail("You don't sponsor that club.");

    const eventIds = new Set(
      db.events.filter((event) => event.clubId === club.id).map((event) => event.id),
    );
    db.clubs = db.clubs.filter((c) => c.id !== club.id);
    db.memberships = db.memberships.filter((m) => m.clubId !== club.id);
    db.events = db.events.filter((e) => e.clubId !== club.id);
    db.eventRsvps = db.eventRsvps.filter((rsvp) => !eventIds.has(rsvp.eventId));
    db.announcements = db.announcements.filter((a) => a.clubId !== club.id);
    return ok;
  });
}

// -------------------------------------------------------- meetings & bulletins

export async function createEvent(input: {
  clubId?: string;
  teamId?: string;
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  description?: string;
}): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);

  if (!input.title.trim() || !input.location.trim())
    return fail("Pick a club or team and fill in title, date, and location.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Pick a valid date.");

  const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
  const start = clock.test(input.start) ? input.start : "16:00";
  const end = clock.test(input.end) ? input.end : "17:00";
  if (end <= start) return fail("The meeting has to end after it starts.");

  return transaction((db) => {
    const club = input.clubId
      ? db.clubs.find((candidate) => candidate.id === input.clubId)
      : undefined;
    const team = input.teamId
      ? db.teams.find((candidate) => candidate.id === input.teamId)
      : undefined;
    if ((!club && !team) || (club && team)) return fail("Pick one club or team.");
    if (club && !canManage(user, club)) return fail("You don't sponsor that club.");
    if (team && !canManageTeam(user, team)) return fail("You don't sponsor that team.");

    db.events.push({
      id: newId("evt"),
      ...(club ? { clubId: club.id } : {}),
      ...(team ? { teamId: team.id } : {}),
      title: input.title.trim(),
      date: input.date,
      start,
      end,
      location: input.location.trim(),
      ...(input.description?.trim() ? { description: input.description.trim().slice(0, 500) } : {}),
    });
    return ok;
  });
}

export async function deleteEvent(input: { id: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);

  return transaction((db) => {
    const event = db.events.find((e) => e.id === input.id);
    if (!event) return ok;
    const club = event.clubId
      ? db.clubs.find((candidate) => candidate.id === event.clubId)
      : undefined;
    const team = event.teamId
      ? db.teams.find((candidate) => candidate.id === event.teamId)
      : undefined;
    if (club ? !canManage(user, club) : team ? !canManageTeam(user, team) : true)
      return fail("You don't manage that club or team.");
    db.events = db.events.filter((e) => e.id !== event.id);
    db.eventRsvps = db.eventRsvps.filter((rsvp) => rsvp.eventId !== event.id);
    return ok;
  });
}

export async function setEventRsvp(input: {
  eventId: string;
  status: EventRsvpStatus;
}): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (user.role !== "student") return fail("Only students can respond to meetings and events.");
  if (!(["going", "maybe", "not-going"] as EventRsvpStatus[]).includes(input.status))
    return fail("Choose Going, Maybe, or Can't go.");

  return transaction((db) => {
    const event = db.events.find((candidate) => candidate.id === input.eventId);
    if (!event) return fail("That meeting no longer exists.");
    const canSee = event.clubId
      ? db.memberships.some(
          (membership) =>
            membership.clubId === event.clubId &&
            membership.userId === user.id &&
            membership.status === "member",
        )
      : event.teamId
        ? db.teamMemberships.some(
            (membership) => membership.teamId === event.teamId && membership.userId === user.id,
          )
        : false;
    if (!canSee) return fail("You can only respond to meetings for clubs and teams you joined.");

    const existing = db.eventRsvps.find(
      (rsvp) => rsvp.eventId === event.id && rsvp.userId === user.id,
    );
    if (existing) {
      existing.status = input.status;
      existing.updatedAt = new Date().toISOString();
    } else {
      db.eventRsvps.push({
        eventId: event.id,
        userId: user.id,
        status: input.status,
        updatedAt: new Date().toISOString(),
      });
    }
    return ok;
  });
}

export async function createAnnouncement(input: {
  clubId?: string;
  teamId?: string;
  schoolWide?: boolean;
  title: string;
  body: string;
}): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (!input.title.trim() || !input.body.trim())
    return fail("Pick an audience, then add a headline and a message.");
  if (input.schoolWide && !isActiveAdmin(user))
    return fail("Only a school admin can send an announcement to the entire school.");

  return transaction((db) => {
    const club = input.clubId
      ? db.clubs.find((candidate) => candidate.id === input.clubId)
      : undefined;
    const team = input.teamId
      ? db.teams.find((candidate) => candidate.id === input.teamId)
      : undefined;
    const targetCount = Number(!!club) + Number(!!team) + Number(!!input.schoolWide);
    if (targetCount !== 1) return fail("Pick exactly one audience.");
    if (club && !canManage(user, club)) return fail("You don't sponsor that club.");
    if (team && !canManageTeam(user, team)) return fail("You don't sponsor that team.");

    db.announcements.push({
      id: newId("ann"),
      ...(input.schoolWide ? { schoolId: user.schoolId! } : {}),
      ...(club ? { clubId: club.id } : {}),
      ...(team ? { teamId: team.id } : {}),
      title: input.title.trim().slice(0, 120),
      body: input.body.trim().slice(0, 2000),
      authorId: user.id,
      postedAt: today(),
    });
    return ok;
  });
}

export async function deleteAnnouncement(input: { id: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);

  return transaction((db) => {
    const post = db.announcements.find((a) => a.id === input.id);
    if (!post) return ok;
    const club = post.clubId
      ? db.clubs.find((candidate) => candidate.id === post.clubId)
      : undefined;
    const team = post.teamId
      ? db.teams.find((candidate) => candidate.id === post.teamId)
      : undefined;
    if (
      post.schoolId
        ? !isActiveAdmin(user) || post.schoolId !== user.schoolId
        : club
          ? !canManage(user, club)
          : team
            ? !canManageTeam(user, team)
            : true
    )
      return fail("You don't manage that announcement's audience.");
    db.announcements = db.announcements.filter((a) => a.id !== post.id);
    return ok;
  });
}

// ---------------------------------------------------------------- tutorials

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export async function createTutorial(input: {
  recurring: boolean;
  weekday?: number;
  date?: string;
  start: string;
  end: string;
  location: string;
}): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (user.role !== "teacher") return fail("Only teachers can publish tutorial times.");
  if (!validTime(input.start) || !validTime(input.end) || input.end <= input.start)
    return fail("Choose a valid start and end time.");
  if (!input.location.trim()) return fail("Enter where students should meet you.");
  if (
    input.recurring &&
    (!Number.isInteger(input.weekday) || input.weekday! < 0 || input.weekday! > 6)
  )
    return fail("Choose a weekday.");
  if (!input.recurring && (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "") || input.date! < today()))
    return fail("Choose today or a future date.");

  return transaction((db) => {
    db.tutorialSchedules.push({
      id: newId("tutorial"),
      schoolId: user.schoolId!,
      teacherId: user.id,
      ...(input.recurring ? { weekday: input.weekday! } : { date: input.date! }),
      start: input.start,
      end: input.end,
      location: input.location.trim().slice(0, 120),
      recurring: input.recurring,
      createdAt: new Date().toISOString(),
    });
    return ok;
  });
}

export async function deleteTutorial(input: { scheduleId: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (user.role !== "teacher") return fail("Only teachers can change tutorial times.");
  return transaction((db) => {
    const schedule = db.tutorialSchedules.find((item) => item.id === input.scheduleId);
    if (!schedule || schedule.teacherId !== user.id) return fail("That tutorial time isn't yours.");
    db.tutorialSchedules = db.tutorialSchedules.filter((item) => item.id !== schedule.id);
    db.tutorialCancellations = db.tutorialCancellations.filter(
      (item) => item.scheduleId !== schedule.id,
    );
    db.tutorialSignups = db.tutorialSignups.filter((item) => item.scheduleId !== schedule.id);
    return ok;
  });
}

export async function setTutorialCancellation(input: {
  scheduleId: string;
  date: string;
  cancelled: boolean;
}): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (user.role !== "teacher") return fail("Only teachers can cancel tutorial times.");
  return transaction((db) => {
    const schedule = db.tutorialSchedules.find((item) => item.id === input.scheduleId);
    if (!schedule || schedule.teacherId !== user.id || !schedule.recurring)
      return fail("That recurring tutorial time isn't yours.");
    if (
      input.date < today() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
      new Date(`${input.date}T12:00:00`).getDay() !== schedule.weekday
    )
      return fail("That date is not one of this schedule's occurrences.");
    db.tutorialCancellations = db.tutorialCancellations.filter(
      (item) => !(item.scheduleId === schedule.id && item.date === input.date),
    );
    if (input.cancelled)
      db.tutorialCancellations.push({ scheduleId: schedule.id, date: input.date });
    return ok;
  });
}

export async function setTutorialTeacher(input: {
  teacherId: string;
  selected: boolean;
}): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (user.role !== "student") return fail("Only students build a tutorial teacher list.");
  return transaction((db) => {
    const teacher = db.users.find(
      (account) =>
        account.id === input.teacherId &&
        account.schoolId === user.schoolId &&
        account.role === "teacher" &&
        account.status === "active",
    );
    if (!teacher) return fail("That teacher isn't available at your school.");
    db.tutorialTeachers = db.tutorialTeachers.filter(
      (item) => !(item.studentId === user.id && item.teacherId === teacher.id),
    );
    if (input.selected) db.tutorialTeachers.push({ studentId: user.id, teacherId: teacher.id });
    if (!input.selected) {
      const scheduleIds = new Set(
        db.tutorialSchedules
          .filter((schedule) => schedule.teacherId === teacher.id)
          .map((schedule) => schedule.id),
      );
      db.tutorialSignups = db.tutorialSignups.filter(
        (signup) => signup.studentId !== user.id || !scheduleIds.has(signup.scheduleId),
      );
    }
    return ok;
  });
}

export async function setTutorialSignup(input: {
  scheduleId: string;
  date: string;
  attending: boolean;
}): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (user.role !== "student") return fail("Only students can sign up for tutorials.");
  return transaction((db) => {
    const schedule = db.tutorialSchedules.find((item) => item.id === input.scheduleId);
    if (!schedule || schedule.schoolId !== user.schoolId) return fail("Tutorial time not found.");
    if (
      input.date < today() ||
      (schedule.recurring
        ? new Date(`${input.date}T12:00:00`).getDay() !== schedule.weekday
        : input.date !== schedule.date)
    )
      return fail("That tutorial occurrence is not available.");
    if (
      !db.tutorialTeachers.some(
        (item) => item.studentId === user.id && item.teacherId === schedule.teacherId,
      )
    )
      return fail("Add this teacher to your list first.");
    if (
      db.tutorialCancellations.some(
        (item) => item.scheduleId === schedule.id && item.date === input.date,
      )
    )
      return fail("That tutorial was cancelled.");
    db.tutorialSignups = db.tutorialSignups.filter(
      (item) =>
        !(
          item.scheduleId === schedule.id &&
          item.date === input.date &&
          item.studentId === user.id
        ),
    );
    if (input.attending)
      db.tutorialSignups.push({
        scheduleId: schedule.id,
        date: input.date,
        studentId: user.id,
        createdAt: new Date().toISOString(),
      });
    return ok;
  });
}

// ------------------------------------------------------------- administration

export async function reviewStaff(input: { userId: string; approve: boolean }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (!isActiveAdmin(user)) return fail("Only a school admin can review staff accounts.");
  if (input.userId === user.id) return fail("You can't change your own approval.");

  return transaction((db) => {
    const target = db.users.find((u) => u.id === input.userId);
    if (!target || target.schoolId !== user.schoolId) return fail("That account no longer exists.");
    if (target.role === "student") return fail("Students don't need approval.");

    target.status = input.approve ? "active" : "denied";
    if (!input.approve) {
      // A revoked sponsor shouldn't keep a live session.
      db.sessions = db.sessions.filter((s) => s.userId !== target.id);
    }
    return ok;
  });
}

export async function setSchoolCode(input: { code: string }): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (!isActiveAdmin(user)) return fail("Only a school admin can change the campus code.");

  const code = input.code.trim().toUpperCase();
  if (code.length < 6) return fail("Codes need at least 6 characters.");
  if (!/^[A-Z0-9-]+$/.test(code)) return fail("Use letters, numbers, and dashes only.");

  return transaction((db) => {
    const school = db.schools.find((candidate) => candidate.id === user.schoolId);
    if (!school) return fail("School not found.");
    if (
      db.schools.some(
        (candidate) => candidate.id !== school.id && norm(candidate.joinCode) === norm(code),
      )
    )
      return fail("That campus code is already in use.");
    school.joinCode = code;
    return ok;
  });
}

export async function setSchoolColors(input: {
  primaryColor: string;
  secondaryColor: string;
}): Promise<Result> {
  const { user, error } = await requireEnrolled();
  if (!user) return fail(error);
  if (!isActiveAdmin(user)) return fail("Only a school admin can change school colors.");

  const primaryColor = input.primaryColor.trim().toLowerCase();
  const secondaryColor = input.secondaryColor.trim().toLowerCase();
  if (!validHexColor(primaryColor) || !validHexColor(secondaryColor))
    return fail("Choose two valid school colors.");

  return transaction((db) => {
    const school = db.schools.find((candidate) => candidate.id === user.schoolId);
    if (!school) return fail("School not found.");
    school.primaryColor = primaryColor;
    school.secondaryColor = secondaryColor;
    return ok;
  });
}
