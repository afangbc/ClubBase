import { createServerFn } from "@tanstack/react-start";
import {
  normalizeSchedule,
  type ClubCategory,
  type EventRsvpStatus,
  type MeetingSchedule,
  type Prefs,
  type Role,
} from "./campus-data";
import type { AppState, ClubInput, CreateSchoolResult, Result } from "@/server/service";

/**
 * The RPC surface. Every handler defers to `src/server/service` through a
 * dynamic import so nothing server-side — the database driver, the password
 * hashing, the session table — can be pulled into the browser bundle.
 *
 * Validators here only shape and bound the payload. Authorization is never
 * decided on this side; the service re-checks the signed-in user for every call.
 */

const str = (value: unknown, max = 500): string =>
  typeof value === "string" ? value.slice(0, max) : "";

const flag = (value: unknown): boolean => value === true;

export type { AppState, Result };

export const getState = createServerFn({ method: "GET" }).handler(async (): Promise<AppState> => {
  const { loadState } = await import("@/server/service");
  return loadState();
});

export const signUpFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      name: string;
      email: string;
      role: Role;
      grade: string;
      password: string;
      schoolCode: string;
    }) => {
      const raw = (d ?? {}) as Partial<typeof d>;
      return {
        name: str(raw.name, 120),
        email: str(raw.email, 200),
        role: (raw.role ?? "student") as Role,
        grade: str(raw.grade, 10),
        password: str(raw.password, 200),
        schoolCode: str(raw.schoolCode, 40),
      };
    },
  )
  .handler(async ({ data }): Promise<Result> => {
    const { signUp } = await import("@/server/service");
    return signUp(data);
  });

export const signInFn = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return { email: str(raw.email, 200), password: str(raw.password, 200) };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { signIn } = await import("@/server/service");
    return signIn(data);
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async (): Promise<Result> => {
  const { signOut } = await import("@/server/service");
  return signOut();
});

export const verifyEmailFn = createServerFn({ method: "POST" })
  .validator((d: { code: string }) => ({ code: str((d ?? {}).code, 6) }))
  .handler(async ({ data }): Promise<Result> => {
    const { verifyEmail } = await import("@/server/service");
    return verifyEmail(data);
  });

export const resendVerificationFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<Result> => {
    const { resendVerification } = await import("@/server/service");
    return resendVerification();
  },
);

export const joinSchoolFn = createServerFn({ method: "POST" })
  .validator((d: { code: string }) => ({ code: str((d ?? {}).code, 40) }))
  .handler(async ({ data }): Promise<Result> => {
    const { joinSchool } = await import("@/server/service");
    return joinSchool(data);
  });

export const leaveSchoolFn = createServerFn({ method: "POST" })
  .validator((d: { password: string }) => ({ password: str((d ?? {}).password, 200) }))
  .handler(async ({ data }): Promise<Result> => {
    const { leaveSchool } = await import("@/server/service");
    return leaveSchool(data);
  });

export const undoLeaveSchoolFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<Result> => {
    const { undoLeaveSchool } = await import("@/server/service");
    return undoLeaveSchool();
  },
);

export const createTeamFn = createServerFn({ method: "POST" })
  .validator((d: { name: string; sport: string }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return { name: str(raw.name, 100), sport: str(raw.sport, 80) };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { createTeam } = await import("@/server/service");
    return createTeam(data);
  });

export const joinTeamFn = createServerFn({ method: "POST" })
  .validator((d: { code: string }) => ({ code: str((d ?? {}).code, 40) }))
  .handler(async ({ data }): Promise<Result> => {
    const { joinTeam } = await import("@/server/service");
    return joinTeam(data);
  });

export const createSchoolFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      name: string;
      mascot: string;
      district: string;
      primaryColor: string;
      secondaryColor: string;
    }) => {
      const raw = (d ?? {}) as Partial<typeof d>;
      return {
        name: str(raw.name, 120),
        mascot: str(raw.mascot, 80),
        district: str(raw.district, 120),
        primaryColor: str(raw.primaryColor, 7),
        secondaryColor: str(raw.secondaryColor, 7),
      };
    },
  )
  .handler(async ({ data }): Promise<CreateSchoolResult> => {
    const { createSchool } = await import("@/server/service");
    return createSchool(data);
  });

export const requestAdminFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      name: string;
      mascot: string;
      district: string;
      primaryColor: string;
      secondaryColor: string;
      message: string;
    }) => {
      const raw = (d ?? {}) as Partial<typeof d>;
      return {
        name: str(raw.name, 120),
        mascot: str(raw.mascot, 80),
        district: str(raw.district, 120),
        primaryColor: str(raw.primaryColor, 7),
        secondaryColor: str(raw.secondaryColor, 7),
        message: str(raw.message, 1000),
      };
    },
  )
  .handler(async ({ data }): Promise<Result> => {
    const { requestAdmin } = await import("@/server/service");
    return requestAdmin(data);
  });

export const reviewAdminRequestFn = createServerFn({ method: "POST" })
  .validator((d: { id: string; approve: boolean }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return { id: str(raw.id, 60), approve: flag(raw.approve) };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { reviewAdminRequest } = await import("@/server/service");
    return reviewAdminRequest(data);
  });

export const revokeAdminFn = createServerFn({ method: "POST" })
  .validator((d: { userId: string }) => ({ userId: str((d ?? {}).userId, 60) }))
  .handler(async ({ data }): Promise<Result> => {
    const { revokeAdmin } = await import("@/server/service");
    return revokeAdmin(data);
  });

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator((d: { name: string; email: string; grade: string }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return { name: str(raw.name, 120), email: str(raw.email, 200), grade: str(raw.grade, 12) };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { updateProfile } = await import("@/server/service");
    return updateProfile(data);
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .validator((d: { current: string; next: string; confirm: string }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return {
      current: str(raw.current, 200),
      next: str(raw.next, 200),
      confirm: str(raw.confirm, 200),
    };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { changePassword } = await import("@/server/service");
    return changePassword(data);
  });

export const updatePrefFn = createServerFn({ method: "POST" })
  .validator((d: { key: keyof Prefs; value: boolean }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return { key: str(raw.key, 40) as keyof Prefs, value: flag(raw.value) };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { updatePref } = await import("@/server/service");
    return updatePref(data);
  });

export const deleteAccountFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<Result> => {
    const { deleteAccount } = await import("@/server/service");
    return deleteAccount();
  },
);

export const joinClubFn = createServerFn({ method: "POST" })
  .validator((d: { clubId: string }) => ({ clubId: str((d ?? {}).clubId, 60) }))
  .handler(async ({ data }): Promise<Result> => {
    const { joinClub } = await import("@/server/service");
    return joinClub(data);
  });

export const leaveClubFn = createServerFn({ method: "POST" })
  .validator((d: { clubId: string }) => ({ clubId: str((d ?? {}).clubId, 60) }))
  .handler(async ({ data }): Promise<Result> => {
    const { leaveClub } = await import("@/server/service");
    return leaveClub(data);
  });

export const requestClubFn = createServerFn({ method: "POST" })
  .validator((d: { clubId: string; note: string }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return { clubId: str(raw.clubId, 60), note: str(raw.note, 400) };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { requestClub } = await import("@/server/service");
    return requestClub(data);
  });

export const reviewMembershipFn = createServerFn({ method: "POST" })
  .validator((d: { id: string; approve: boolean }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return { id: str(raw.id, 60), approve: flag(raw.approve) };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { reviewMembership } = await import("@/server/service");
    return reviewMembership(data);
  });

function clubInput(raw: Partial<ClubInput>): Required<ClubInput> {
  return {
    name: str(raw.name, 80),
    category: str(raw.category, 20) as ClubCategory,
    visibility: raw.visibility === "private" ? "private" : "public",
    room: str(raw.room, 60),
    // Bounds every field of the schedule before it reaches the service.
    schedule: normalizeSchedule(raw.schedule as Partial<MeetingSchedule> | undefined),
    blurb: str(raw.blurb, 600),
    logo: str(raw.logo, 450_000),
    joinInstructions: str(raw.joinInstructions, 600),
    sponsorId: str(raw.sponsorId, 60),
  };
}

export const createClubFn = createServerFn({ method: "POST" })
  .validator((d: ClubInput) => clubInput((d ?? {}) as Partial<ClubInput>))
  .handler(async ({ data }): Promise<Result> => {
    const { createClub } = await import("@/server/service");
    return createClub(data);
  });

export const updateClubFn = createServerFn({ method: "POST" })
  .validator((d: { id: string; patch: Partial<ClubInput> }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    const patch = (raw.patch ?? {}) as Partial<ClubInput>;
    const shaped = clubInput(patch);
    // Only forward the keys the caller actually set, so a partial edit stays partial.
    const out: Partial<ClubInput> = {};
    for (const key of Object.keys(patch) as (keyof ClubInput)[]) {
      if (key === "visibility") out.visibility = shaped.visibility;
      else if (key === "category") out.category = shaped.category;
      else if (key === "schedule") out.schedule = shaped.schedule;
      else out[key] = shaped[key];
    }
    return { id: str(raw.id, 60), patch: out };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { updateClub } = await import("@/server/service");
    return updateClub(data);
  });

export const deleteClubFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => ({ id: str((d ?? {}).id, 60) }))
  .handler(async ({ data }): Promise<Result> => {
    const { deleteClub } = await import("@/server/service");
    return deleteClub(data);
  });

export const createEventFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      clubId?: string;
      teamId?: string;
      title: string;
      date: string;
      start: string;
      end: string;
      location: string;
      description?: string;
    }) => {
      const raw = (d ?? {}) as Partial<typeof d>;
      return {
        clubId: str(raw.clubId, 60),
        teamId: str(raw.teamId, 60),
        title: str(raw.title, 120),
        date: str(raw.date, 10),
        start: str(raw.start, 20),
        end: str(raw.end, 20),
        location: str(raw.location, 80),
        description: str(raw.description, 500),
      };
    },
  )
  .handler(async ({ data }): Promise<Result> => {
    const { createEvent } = await import("@/server/service");
    return createEvent(data);
  });

export const deleteEventFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => ({ id: str((d ?? {}).id, 60) }))
  .handler(async ({ data }): Promise<Result> => {
    const { deleteEvent } = await import("@/server/service");
    return deleteEvent(data);
  });

export const setEventRsvpFn = createServerFn({ method: "POST" })
  .validator((d: { eventId: string; status: EventRsvpStatus }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return {
      eventId: str(raw.eventId, 60),
      status: str(raw.status, 20) as EventRsvpStatus,
    };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { setEventRsvp } = await import("@/server/service");
    return setEventRsvp(data);
  });

export const createAnnouncementFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      clubId?: string;
      teamId?: string;
      schoolWide?: boolean;
      title: string;
      body: string;
    }) => {
      const raw = (d ?? {}) as Partial<typeof d>;
      return {
        clubId: str(raw.clubId, 60),
        teamId: str(raw.teamId, 60),
        schoolWide: flag(raw.schoolWide),
        title: str(raw.title, 120),
        body: str(raw.body, 2000),
      };
    },
  )
  .handler(async ({ data }): Promise<Result> => {
    const { createAnnouncement } = await import("@/server/service");
    return createAnnouncement(data);
  });

export const deleteAnnouncementFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => ({ id: str((d ?? {}).id, 60) }))
  .handler(async ({ data }): Promise<Result> => {
    const { deleteAnnouncement } = await import("@/server/service");
    return deleteAnnouncement(data);
  });

export const reviewStaffFn = createServerFn({ method: "POST" })
  .validator((d: { userId: string; approve: boolean }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return { userId: str(raw.userId, 60), approve: flag(raw.approve) };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { reviewStaff } = await import("@/server/service");
    return reviewStaff(data);
  });

export const setSchoolCodeFn = createServerFn({ method: "POST" })
  .validator((d: { code: string }) => ({ code: str((d ?? {}).code, 40) }))
  .handler(async ({ data }): Promise<Result> => {
    const { setSchoolCode } = await import("@/server/service");
    return setSchoolCode(data);
  });

export const setSchoolColorsFn = createServerFn({ method: "POST" })
  .validator((d: { primaryColor: string; secondaryColor: string }) => {
    const raw = (d ?? {}) as Partial<typeof d>;
    return { primaryColor: str(raw.primaryColor, 7), secondaryColor: str(raw.secondaryColor, 7) };
  })
  .handler(async ({ data }): Promise<Result> => {
    const { setSchoolColors } = await import("@/server/service");
    return setSchoolColors(data);
  });

export const createTutorialFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      recurring: boolean;
      weekday?: number;
      date?: string;
      start: string;
      end: string;
      location: string;
    }) => {
      const raw = (d ?? {}) as Partial<typeof d>;
      return {
        recurring: flag(raw.recurring),
        ...(typeof raw.weekday === "number" ? { weekday: raw.weekday } : {}),
        ...(raw.date === undefined ? {} : { date: str(raw.date, 10) }),
        start: str(raw.start, 5),
        end: str(raw.end, 5),
        location: str(raw.location, 120),
      };
    },
  )
  .handler(async ({ data }): Promise<Result> => {
    const { createTutorial } = await import("@/server/service");
    return createTutorial(data);
  });

export const deleteTutorialFn = createServerFn({ method: "POST" })
  .validator((d: { scheduleId: string }) => ({ scheduleId: str((d ?? {}).scheduleId, 80) }))
  .handler(async ({ data }): Promise<Result> => {
    const { deleteTutorial } = await import("@/server/service");
    return deleteTutorial(data);
  });

export const setTutorialCancellationFn = createServerFn({ method: "POST" })
  .validator((d: { scheduleId: string; date: string; cancelled: boolean }) => ({
    scheduleId: str((d ?? {}).scheduleId, 80),
    date: str((d ?? {}).date, 10),
    cancelled: flag((d ?? {}).cancelled),
  }))
  .handler(async ({ data }): Promise<Result> => {
    const { setTutorialCancellation } = await import("@/server/service");
    return setTutorialCancellation(data);
  });

export const setTutorialTeacherFn = createServerFn({ method: "POST" })
  .validator((d: { teacherId: string; selected: boolean }) => ({
    teacherId: str((d ?? {}).teacherId, 80),
    selected: flag((d ?? {}).selected),
  }))
  .handler(async ({ data }): Promise<Result> => {
    const { setTutorialTeacher } = await import("@/server/service");
    return setTutorialTeacher(data);
  });

export const setTutorialSignupFn = createServerFn({ method: "POST" })
  .validator((d: { scheduleId: string; date: string; attending: boolean }) => ({
    scheduleId: str((d ?? {}).scheduleId, 80),
    date: str((d ?? {}).date, 10),
    attending: flag((d ?? {}).attending),
  }))
  .handler(async ({ data }): Promise<Result> => {
    const { setTutorialSignup } = await import("@/server/service");
    return setTutorialSignup(data);
  });
