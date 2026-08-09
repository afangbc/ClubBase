import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import {
  changePasswordFn,
  createAnnouncementFn,
  createClubFn,
  createEventFn,
  createTeamFn,
  createTutorialFn,
  createSchoolFn,
  deleteAccountFn,
  deleteAnnouncementFn,
  deleteClubFn,
  deleteEventFn,
  deleteTutorialFn,
  getState,
  joinClubFn,
  joinSchoolFn,
  joinTeamFn,
  leaveSchoolFn,
  leaveClubFn,
  requestAdminFn,
  requestClubFn,
  resendVerificationFn,
  reviewAdminRequestFn,
  reviewMembershipFn,
  reviewStaffFn,
  revokeAdminFn,
  setSchoolCodeFn,
  setSchoolColorsFn,
  setEventRsvpFn,
  setTutorialCancellationFn,
  setTutorialSignupFn,
  setTutorialTeacherFn,
  signInFn,
  signOutFn,
  signUpFn,
  updateClubFn,
  updatePrefFn,
  updateProfileFn,
  undoLeaveSchoolFn,
  verifyEmailFn,
  type AppState,
  type Result,
} from "./api";
import {
  defaultPrefs,
  type AdminRequest,
  type Announcement,
  type Club,
  type ClubMember,
  type ClubEvent,
  type EventRsvp,
  type EventRsvpStatus,
  type JoinRequest,
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
} from "./campus-data";
import type { ClubInput } from "@/server/service";

export type { ClubInput };

/** Every action resolves to an error message, or null when it worked. */
type Action<T extends unknown[]> = (...args: T) => Promise<string | null>;

type State = {
  ready: boolean;
  session: Session | null;
  /** True once the account has entered the campus access code. */
  joined: boolean;
  /** True for the people who run ClubHub itself. */
  isOwner: boolean;
  /** False until the emailed code comes back; gates the whole app. */
  emailVerified: boolean;
  /** True in local dev with no mail provider — codes print to the server console. */
  emailInConsoleMode: boolean;
  prefs: Prefs;
  school: AppState["school"];
  clubs: Club[];
  clubMembers: Record<string, ClubMember[]>;
  teams: Team[];
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
  users: SchoolAccount[];
  pendingStaff: StaffAccount[];
  sponsors: StaffAccount[];
  schoolCode: string;
  schools: SchoolDetail[];
  adminRequests: AdminRequest[];
  pendingAdminRequests: AdminRequest[];
  myAdminRequest: AdminRequest | null;
  schoolOptions: SchoolSummary[];
  schoolDeparture: AppState["schoolDeparture"];
  ownersConfigured: boolean;
  refresh: () => Promise<void>;
  signIn: Action<[string, string]>;
  signUp: Action<
    [
      {
        name: string;
        email: string;
        role: Role;
        grade: string;
        password: string;
        schoolCode: string;
      },
    ]
  >;
  signOut: Action<[]>;
  verifyEmail: Action<[string]>;
  resendVerification: Action<[]>;
  joinSchool: Action<[string]>;
  leaveSchool: Action<[string]>;
  undoLeaveSchool: Action<[]>;
  updateProfile: Action<[{ name: string; email: string; grade: string }]>;
  changePassword: Action<[string, string, string]>;
  setPref: Action<[keyof Prefs, boolean]>;
  deleteAccount: Action<[]>;
  joinClub: Action<[string]>;
  leaveClub: Action<[string]>;
  requestClub: Action<[string, string]>;
  createClub: Action<[ClubInput]>;
  createTeam: Action<[{ name: string; sport: string }]>;
  joinTeam: Action<[string]>;
  updateClub: Action<[string, Partial<ClubInput>]>;
  deleteClub: Action<[string]>;
  addEvent: Action<[Omit<ClubEvent, "id">]>;
  removeEvent: Action<[string]>;
  setEventRsvp: Action<[string, EventRsvpStatus]>;
  addAnnouncement: Action<
    [{ clubId?: string; teamId?: string; schoolWide?: boolean; title: string; body: string }]
  >;
  removeAnnouncement: Action<[string]>;
  createTutorial: Action<
    [
      {
        recurring: boolean;
        weekday?: number;
        date?: string;
        start: string;
        end: string;
        location: string;
      },
    ]
  >;
  deleteTutorial: Action<[string]>;
  setTutorialCancellation: Action<[string, string, boolean]>;
  setTutorialTeacher: Action<[string, boolean]>;
  setTutorialSignup: Action<[string, string, boolean]>;
  resolveRequest: Action<[string, boolean]>;
  reviewStaff: Action<[string, boolean]>;
  updateSchoolCode: Action<[string]>;
  updateSchoolColors: Action<[{ primaryColor: string; secondaryColor: string }]>;
  requestAdmin: Action<
    [
      {
        name: string;
        district: string;
        mascot: string;
        primaryColor: string;
        secondaryColor: string;
        message: string;
      },
    ]
  >;
  reviewAdminRequest: Action<[string, boolean]>;
  revokeAdmin: Action<[string]>;
  createSchool: (input: {
    name: string;
    district: string;
    mascot: string;
    primaryColor: string;
    secondaryColor: string;
  }) => Promise<{ error: string | null; joinCode?: string | undefined }>;
};

const emptyState: AppState = {
  user: null,
  prefs: defaultPrefs,
  school: null,
  clubs: [],
  clubMembers: {},
  teams: [],
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
  schoolDeparture: null,
  ownersConfigured: true,
  emailInConsoleMode: false,
};

export const stateQueryKey = ["clubhub", "state"] as const;

/**
 * Tells a dead connection apart from a server that answered and then failed.
 *
 * The browser only produces a `TypeError` when the request never completed, so
 * anything else means the server was reached and broke inside — a missing
 * database binding, say. Blaming those on the user's wifi sends whoever is
 * debugging to entirely the wrong place.
 */
function describeFailure(error: unknown): string {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline || error instanceof TypeError)
    return "Couldn't reach the server. Check your connection and try again.";
  return "The server hit an error handling that. If it keeps happening, whoever runs this site should check the server logs.";
}

const Ctx = createContext<State | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: stateQueryKey,
    queryFn: () => getState(),
    // The server is the only source of truth; never serve a stale view of it.
    staleTime: 0,
    retry: false,
  });

  const state = data ?? emptyState;

  useEffect(() => {
    const root = document.documentElement;
    const school = state.school;
    if (!school) {
      ["--primary", "--primary-foreground", "--brand", "--brand-foreground"].forEach((key) =>
        root.style.removeProperty(key),
      );
      return;
    }
    const foreground = (hex: string) => {
      const rgb = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
      return (rgb[0]! * 299 + rgb[1]! * 587 + rgb[2]! * 114) / 1000 > 150 ? "#111827" : "#ffffff";
    };
    root.style.setProperty("--primary", school.primaryColor);
    root.style.setProperty("--primary-foreground", foreground(school.primaryColor));
    root.style.setProperty("--brand", school.secondaryColor);
    root.style.setProperty("--brand-foreground", foreground(school.secondaryColor));
  }, [state.school]);

  const value = useMemo<State>(() => {
    const refresh = async () => {
      await queryClient.invalidateQueries({ queryKey: stateQueryKey });
    };

    /** Runs a server call, then re-reads state so the UI matches the database. */
    const run = async (call: () => Promise<Result>): Promise<string | null> => {
      let result: Result;
      try {
        result = await call();
      } catch (error) {
        console.error(error);
        return describeFailure(error);
      }
      await refresh();
      return result.error;
    };

    const staff = state.staff;

    return {
      ready: !isPending,
      session: state.user,
      joined: !!state.user?.schoolId,
      isOwner: !!state.user?.owner,
      emailVerified: !!state.user?.emailVerified,
      emailInConsoleMode: state.emailInConsoleMode,
      prefs: state.prefs,
      school: state.school,
      clubs: state.clubs,
      clubMembers: state.clubMembers,
      teams: state.teams,
      events: state.events,
      eventRsvps: state.eventRsvps,
      announcements: state.announcements,
      tutorialTeachers: state.tutorialTeachers,
      selectedTutorialTeachers: state.selectedTutorialTeachers,
      tutorials: state.tutorials,
      myClubs: state.myClubs,
      pending: state.pending,
      requests: state.requests,
      staff,
      users: state.users,
      pendingStaff: staff.filter((s) => s.status === "pending"),
      sponsors: staff.filter((s) => s.status === "active"),
      schoolCode: state.schoolCode,
      schools: state.schools,
      adminRequests: state.adminRequests,
      pendingAdminRequests: state.adminRequests.filter((r) => r.status === "pending"),
      myAdminRequest: state.myAdminRequest,
      schoolOptions: state.schoolOptions,
      schoolDeparture: state.schoolDeparture,
      ownersConfigured: state.ownersConfigured,
      refresh,

      signIn: (email, password) => run(() => signInFn({ data: { email, password } })),
      signUp: (input) => run(() => signUpFn({ data: input })),
      signOut: () => run(() => signOutFn()),
      verifyEmail: (code) => run(() => verifyEmailFn({ data: { code } })),
      resendVerification: () => run(() => resendVerificationFn()),
      joinSchool: (code) => run(() => joinSchoolFn({ data: { code } })),
      leaveSchool: (password) => run(() => leaveSchoolFn({ data: { password } })),
      undoLeaveSchool: () => run(() => undoLeaveSchoolFn()),
      updateProfile: (input) => run(() => updateProfileFn({ data: input })),
      changePassword: (current, next, confirm) =>
        run(() => changePasswordFn({ data: { current, next, confirm } })),
      setPref: (key, value) => run(() => updatePrefFn({ data: { key, value } })),
      deleteAccount: () => run(() => deleteAccountFn()),

      joinClub: (clubId) => run(() => joinClubFn({ data: { clubId } })),
      leaveClub: (clubId) => run(() => leaveClubFn({ data: { clubId } })),
      requestClub: (clubId, note) => run(() => requestClubFn({ data: { clubId, note } })),

      createClub: (input) => run(() => createClubFn({ data: input })),
      updateClub: (id, patch) => run(() => updateClubFn({ data: { id, patch } })),
      deleteClub: (id) => run(() => deleteClubFn({ data: { id } })),
      createTeam: (input) => run(() => createTeamFn({ data: input })),
      joinTeam: (code) => run(() => joinTeamFn({ data: { code } })),

      addEvent: (event) => run(() => createEventFn({ data: event })),
      removeEvent: (id) => run(() => deleteEventFn({ data: { id } })),
      setEventRsvp: (eventId, status) => run(() => setEventRsvpFn({ data: { eventId, status } })),
      addAnnouncement: (post) => run(() => createAnnouncementFn({ data: post })),
      removeAnnouncement: (id) => run(() => deleteAnnouncementFn({ data: { id } })),
      createTutorial: (input) => run(() => createTutorialFn({ data: input })),
      deleteTutorial: (scheduleId) => run(() => deleteTutorialFn({ data: { scheduleId } })),
      setTutorialCancellation: (scheduleId, date, cancelled) =>
        run(() => setTutorialCancellationFn({ data: { scheduleId, date, cancelled } })),
      setTutorialTeacher: (teacherId, selected) =>
        run(() => setTutorialTeacherFn({ data: { teacherId, selected } })),
      setTutorialSignup: (scheduleId, date, attending) =>
        run(() => setTutorialSignupFn({ data: { scheduleId, date, attending } })),

      resolveRequest: (id, approve) => run(() => reviewMembershipFn({ data: { id, approve } })),
      reviewStaff: (userId, approve) => run(() => reviewStaffFn({ data: { userId, approve } })),
      updateSchoolCode: (code) => run(() => setSchoolCodeFn({ data: { code } })),
      updateSchoolColors: (colors) => run(() => setSchoolColorsFn({ data: colors })),

      requestAdmin: (input) => run(() => requestAdminFn({ data: input })),
      reviewAdminRequest: (id, approve) =>
        run(() => reviewAdminRequestFn({ data: { id, approve } })),
      revokeAdmin: (userId) => run(() => revokeAdminFn({ data: { userId } })),
      // Returns the generated campus code alongside the error, so it can't go
      // through `run` like the others.
      createSchool: async (input) => {
        try {
          const result = await createSchoolFn({ data: input });
          await refresh();
          return result;
        } catch (error) {
          console.error(error);
          return { error: "Couldn't reach the server. Check your connection and try again." };
        }
      },
    };
  }, [state, isPending, queryClient]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
