import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { createSessionToken, hashToken } from "./crypto";
import type { UserRecord } from "./schema";
import { getDatabase, transaction } from "./store";

const COOKIE_NAME = "clubbase_session";
const LEGACY_COOKIE_NAME = `club${"hub"}_session`;
const SESSION_DAYS = 30;

function expiryFromNow(): string {
  const date = new Date();
  date.setDate(date.getDate() + SESSION_DAYS);
  return date.toISOString();
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    // Localhost dev runs over plain http, so this can only be forced in production.
    secure: import.meta.env?.PROD === true,
  } as const;
}

/** Issues a fresh session token and drops it in an HttpOnly cookie. */
export async function startSession(userId: string): Promise<void> {
  const token = createSessionToken();
  const tokenHash = await hashToken(token);
  const now = new Date();

  await transaction((db) => {
    db.sessions = db.sessions.filter((s) => new Date(s.expiresAt) > now);
    db.sessions.push({
      tokenHash,
      userId,
      createdAt: now.toISOString(),
      expiresAt: expiryFromNow(),
    });
  });

  setCookie(COOKIE_NAME, token, cookieOptions());
}

export async function endSession(): Promise<void> {
  const token = getCookie(COOKIE_NAME) ?? getCookie(LEGACY_COOKIE_NAME);
  if (token) {
    const tokenHash = await hashToken(token);
    await transaction((db) => {
      db.sessions = db.sessions.filter((s) => s.tokenHash !== tokenHash);
    });
  }
  deleteCookie(COOKIE_NAME, { path: "/" });
  deleteCookie(LEGACY_COOKIE_NAME, { path: "/" });
}

/** Invalidates every session for a user — used after a password change. */
export async function endAllSessions(userId: string): Promise<void> {
  await transaction((db) => {
    db.sessions = db.sessions.filter((s) => s.userId !== userId);
  });
  deleteCookie(COOKIE_NAME, { path: "/" });
  deleteCookie(LEGACY_COOKIE_NAME, { path: "/" });
}

export async function currentUser(): Promise<UserRecord | null> {
  const token = getCookie(COOKIE_NAME) ?? getCookie(LEGACY_COOKIE_NAME);
  if (!token) return null;

  const tokenHash = await hashToken(token);
  const db = await getDatabase();
  const session = db.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session) return null;

  if (new Date(session.expiresAt) <= new Date()) {
    await transaction((next) => {
      next.sessions = next.sessions.filter((s) => s.tokenHash !== tokenHash);
    });
    deleteCookie(COOKIE_NAME, { path: "/" });
    return null;
  }

  return db.users.find((u) => u.id === session.userId) ?? null;
}

/**
 * Sign-in throttling. Held in memory on purpose: it protects a single process
 * against online guessing and is not worth a database write per attempt.
 */
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

export function throttled(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
