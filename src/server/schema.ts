import {
  DEMO_PASSWORD,
  SCHOOL,
  defaultPrefs,
  type AccountStatus,
  type AdminRequestStatus,
  type ClubCategory,
  type MeetingSchedule,
  type Prefs,
  type Role,
} from "@/lib/campus-data";
import { hashPassword } from "./crypto";

export const DB_VERSION = 15;

export type SchoolRecord = {
  id: string;
  name: string;
  mascot: string;
  district: string;
  joinCode: string;
  primaryColor: string;
  secondaryColor: string;
  /** Isolated demo campuses expire automatically and never appear to owners. */
  demoExpiresAt?: string;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  passwordHash: string;
  /** False until the six-digit code we mailed to `email` comes back. */
  emailVerified: boolean;
  /** Null until the account enters the campus access code. */
  schoolId: string | null;
  grade?: string;
  department?: string;
  note?: string;
  prefs: Prefs;
  createdAt: string;
};

export type ClubRecord = {
  id: string;
  schoolId: string;
  name: string;
  category: ClubCategory;
  visibility: "public" | "private";
  sponsorId: string;
  room: string;
  /** Structured, so the app renders the phrasing instead of a sponsor typing it. */
  schedule: MeetingSchedule;
  blurb: string;
  logo?: string;
  joinInstructions?: string;
  createdAt: string;
};

export type MembershipRecord = {
  id: string;
  clubId: string;
  userId: string;
  status: "member" | "pending";
  note: string;
  createdAt: string;
};

export type TeamRecord = {
  id: string;
  schoolId: string;
  name: string;
  sport: string;
  sponsorId: string;
  joinCode: string;
  createdAt: string;
};

export type TeamMembershipRecord = {
  id: string;
  teamId: string;
  userId: string;
  createdAt: string;
};

export type EventRecord = {
  id: string;
  clubId?: string;
  teamId?: string;
  title: string;
  date: string;
  /** 24-hour "HH:MM". */
  start: string;
  end: string;
  location: string;
  description?: string;
};

export type EventRsvpRecord = {
  eventId: string;
  userId: string;
  status: "going" | "maybe" | "not-going";
  updatedAt: string;
};

export type AnnouncementRecord = {
  id: string;
  schoolId?: string;
  clubId?: string;
  teamId?: string;
  title: string;
  body: string;
  authorId: string;
  postedAt: string;
};

export type TutorialScheduleRecord = {
  id: string;
  schoolId: string;
  teacherId: string;
  /** Present for weekly rules; absent for one-time sessions. */
  weekday?: number;
  /** Present for one-time sessions; weekly dates are generated from weekday. */
  date?: string;
  start: string;
  end: string;
  location: string;
  recurring: boolean;
  createdAt: string;
};

export type TutorialCancellationRecord = { scheduleId: string; date: string };
export type TutorialTeacherRecord = { studentId: string; teacherId: string };
export type TutorialSignupRecord = {
  scheduleId: string;
  date: string;
  studentId: string;
  createdAt: string;
};

export type SessionRecord = {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

/**
 * A live six-digit code. Only its hash is kept, so a database dump can't be
 * replayed to verify somebody else's address. One row per account — requesting
 * a new code replaces the old one.
 */
export type EmailVerificationRecord = {
  userId: string;
  /** The address the code was sent to, so changing your email invalidates it. */
  email: string;
  codeHash: string;
  expiresAt: string;
  sentAt: string;
  attempts: number;
};

/** An account asking a ClubBase owner to approve a brand-new campus. */
export type AdminRequestRecord = {
  id: string;
  userId: string;
  schoolId?: string;
  schoolName: string;
  district: string;
  mascot: string;
  primaryColor: string;
  secondaryColor: string;
  message: string;
  status: AdminRequestStatus;
  createdAt: string;
  decidedAt?: string;
  /** The owner's user id, kept so a decision can be traced back to a person. */
  decidedBy?: string;
};

/** Recoverable school-specific data retained for the 14-day transfer grace period. */
export type SchoolDepartureRecord = {
  userId: string;
  schoolId: string;
  schoolName: string;
  previousStatus: AccountStatus;
  leftAt: string;
  expiresAt: string;
  memberships: MembershipRecord[];
  teamMemberships: TeamMembershipRecord[];
  eventRsvps: EventRsvpRecord[];
  tutorialSchedules: TutorialScheduleRecord[];
  tutorialCancellations: TutorialCancellationRecord[];
  tutorialTeachers: TutorialTeacherRecord[];
  tutorialSignups: TutorialSignupRecord[];
  sponsoredClubIds: string[];
  sponsoredTeamIds: string[];
};

export type Database = {
  version: number;
  schools: SchoolRecord[];
  users: UserRecord[];
  clubs: ClubRecord[];
  memberships: MembershipRecord[];
  teams: TeamRecord[];
  teamMemberships: TeamMembershipRecord[];
  events: EventRecord[];
  eventRsvps: EventRsvpRecord[];
  announcements: AnnouncementRecord[];
  tutorialSchedules: TutorialScheduleRecord[];
  tutorialCancellations: TutorialCancellationRecord[];
  tutorialTeachers: TutorialTeacherRecord[];
  tutorialSignups: TutorialSignupRecord[];
  sessions: SessionRecord[];
  adminRequests: AdminRequestRecord[];
  emailVerifications: EmailVerificationRecord[];
  schoolDepartures: SchoolDepartureRecord[];
};

export const FRISCO_SCHOOL_ID = "sch-frisco-hs";

/**
 * The starting database: one real campus and nothing else.
 *
 * There are deliberately no seeded accounts, clubs, or meetings. Everything a
 * student sees is something a real person at the school created — an owner
 * approves the first admin, that admin approves sponsors, and sponsors build the
 * club list from there.
 */
export async function buildSeedDatabase(): Promise<Database> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const createdAt = new Date().toISOString();
  const day = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  return {
    version: DB_VERSION,
    schools: [
      {
        id: FRISCO_SCHOOL_ID,
        name: SCHOOL.name,
        mascot: SCHOOL.mascot,
        district: SCHOOL.district,
        joinCode: SCHOOL.defaultJoinCode,
        primaryColor: "#0033a0",
        secondaryColor: "#ffd100",
      },
    ],
    users: [
      {
        id: "u-nguyen",
        name: "Alicia Nguyen",
        email: "admin@demo.clubbase.app",
        role: "admin",
        status: "active",
        passwordHash,
        emailVerified: true,
        schoolId: FRISCO_SCHOOL_ID,
        department: "Assistant Principal · Student Activities",
        prefs: { ...defaultPrefs },
        createdAt,
      },
      {
        id: "u-alvarez",
        name: "Marcus Alvarez",
        email: "teacher@demo.clubbase.app",
        role: "teacher",
        status: "active",
        passwordHash,
        emailVerified: true,
        schoolId: FRISCO_SCHOOL_ID,
        department: "Career & Technical Education",
        prefs: { ...defaultPrefs },
        createdAt,
      },
      {
        id: "u-whitfield",
        name: "Dana Whitfield",
        email: `dana.whitfield@${SCHOOL.staffDomain}`,
        role: "teacher",
        status: "active",
        passwordHash,
        emailVerified: true,
        schoolId: FRISCO_SCHOOL_ID,
        department: "Social Studies",
        prefs: { ...defaultPrefs },
        createdAt,
      },
      {
        id: "u-raman",
        name: "Priya Raman",
        email: `priya.raman@${SCHOOL.staffDomain}`,
        role: "teacher",
        status: "pending",
        passwordHash,
        emailVerified: true,
        schoolId: FRISCO_SCHOOL_ID,
        department: "Science",
        note: "Wants to sponsor Science Olympiad this fall.",
        prefs: { ...defaultPrefs },
        createdAt,
      },
      ...[
        ["u-rivera", "Jordan Rivera", "student", "11th"],
        ["u-fitzgerald", "Maya Fitzgerald", "maya.fitzgerald.204", "11th"],
        ["u-park", "Devin Park", "devin.park.088", "12th"],
        ["u-brooks", "Aaliyah Brooks", "aaliyah.brooks.317", "10th"],
        ["u-iqbal", "Sana Iqbal", "sana.iqbal.529", "9th"],
      ].map(([id, name, handle, grade]) => ({
        id: id!,
        name: name!,
        email:
          id === "u-rivera" ? "student@demo.clubbase.app" : `${handle}@${SCHOOL.studentDomain}`,
        role: "student" as const,
        status: "active" as const,
        passwordHash,
        emailVerified: true,
        schoolId: FRISCO_SCHOOL_ID,
        grade: grade!,
        prefs: { ...defaultPrefs },
        createdAt,
      })),
    ],
    clubs: [
      {
        id: "c-tsa",
        schoolId: FRISCO_SCHOOL_ID,
        name: "Technology Student Association",
        category: "STEM",
        visibility: "public",
        sponsorId: "u-alvarez",
        room: "C-214",
        schedule: { frequency: "weekly", weekday: 2, week: 1, hour: 16, minute: 15 },
        blurb: "Compete in engineering, coding, and design events at region and state.",
        createdAt,
      },
      {
        id: "c-robotics",
        schoolId: FRISCO_SCHOOL_ID,
        name: "Robotics Team 4412",
        category: "STEM",
        visibility: "private",
        sponsorId: "u-alvarez",
        room: "Shop B",
        schedule: { frequency: "biweekly", weekday: 3, week: 1, hour: 16, minute: 0 },
        blurb: "Build season, tools, CAD, programming, and drive team.",
        joinInstructions: "Attend an open build night and complete the shop safety quiz.",
        createdAt,
      },
      {
        id: "c-nhs",
        schoolId: FRISCO_SCHOOL_ID,
        name: "National Honor Society",
        category: "Service",
        visibility: "private",
        sponsorId: "u-whitfield",
        room: "Library",
        schedule: { frequency: "monthly", weekday: 4, week: 1, hour: 7, minute: 30 },
        blurb: "Scholarship, service, leadership, and character.",
        joinInstructions: "Submit the interest form and service-hour record to the sponsor.",
        createdAt,
      },
      {
        id: "c-key",
        schoolId: FRISCO_SCHOOL_ID,
        name: "Key Club",
        category: "Service",
        visibility: "public",
        sponsorId: "u-whitfield",
        room: "B-220",
        schedule: { frequency: "weekly", weekday: 4, week: 1, hour: 16, minute: 0 },
        blurb: "Volunteer projects across Frisco ISD with service hours tracked together.",
        createdAt,
      },
    ],
    memberships: [
      ["m-1", "c-tsa", "u-rivera", "member", ""],
      ["m-2", "c-tsa", "u-park", "member", ""],
      ["m-3", "c-key", "u-rivera", "member", ""],
      ["m-4", "c-key", "u-fitzgerald", "member", ""],
      ["m-5", "c-robotics", "u-park", "member", ""],
      ["m-6", "c-robotics", "u-brooks", "pending", "Safety quiz passed at open build night."],
      ["m-7", "c-robotics", "u-iqbal", "pending", "CAD experience from middle school."],
      ["m-8", "c-nhs", "u-fitzgerald", "pending", "3.8 GPA and 24 service hours."],
    ].map(([id, clubId, userId, status, note]) => ({
      id: id!,
      clubId: clubId!,
      userId: userId!,
      status: status as "member" | "pending",
      note: note!,
      createdAt,
    })),
    teams: [
      {
        id: "t-basketball",
        schoolId: FRISCO_SCHOOL_ID,
        name: "Varsity Basketball",
        sport: "Basketball",
        sponsorId: "u-alvarez",
        joinCode: "HOOPS-4412",
        createdAt,
      },
    ],
    teamMemberships: [{ id: "tm-1", teamId: "t-basketball", userId: "u-park", createdAt }],
    events: [
      {
        id: "e-1",
        clubId: "c-tsa",
        title: "TSA General Meeting",
        date: day(1),
        start: "16:15",
        end: "17:15",
        location: "C-214",
      },
      {
        id: "e-2",
        clubId: "c-robotics",
        title: "Open Build Night",
        date: day(3),
        start: "16:00",
        end: "19:00",
        location: "Shop B",
      },
      {
        id: "e-3",
        clubId: "c-key",
        title: "Park Cleanup Sign-Up",
        date: day(5),
        start: "16:00",
        end: "16:45",
        location: "B-220",
      },
      {
        id: "e-4",
        clubId: "c-nhs",
        title: "Induction Rehearsal",
        date: day(8),
        start: "07:30",
        end: "08:15",
        location: "Auditorium",
      },
    ],
    eventRsvps: [],
    announcements: [
      {
        id: "a-1",
        clubId: "c-tsa",
        title: "Region forms due Friday",
        body: "Choose your events and return the signed entry form by Friday.",
        authorId: "u-alvarez",
        postedAt: day(-1),
      },
      {
        id: "a-2",
        clubId: "c-key",
        title: "Cleanup needs volunteers",
        body: "Saturday morning at Frisco Commons. The event counts for three service hours.",
        authorId: "u-whitfield",
        postedAt: day(-2),
      },
    ],
    tutorialSchedules: [],
    tutorialCancellations: [],
    tutorialTeachers: [],
    tutorialSignups: [],
    sessions: [],
    adminRequests: [],
    emailVerifications: [],
    schoolDepartures: [],
  };
}
