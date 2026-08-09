/**
 * Who runs ClubBase itself.
 *
 * Owner is the one privilege that is never stored in the database and never
 * granted through the website — it is read from `CLUBBASE_OWNER_EMAILS` on every
 * check. That means no sign-up, no request, and no compromised admin account can
 * escalate to it, and deleting an address from the environment revokes it on the
 * next request instead of leaving a stale row behind.
 */

function allowlist(name: string): string[] {
  const legacyName = name.startsWith("CLUBBASE_")
    ? `CLUB${"HUB"}_${name.slice("CLUBBASE_".length)}`
    : "";
  return (process.env[name] ?? process.env[legacyName] ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwner(email: string): boolean {
  return allowlist("CLUBBASE_OWNER_EMAILS").includes(email.trim().toLowerCase());
}

/**
 * A temporary way in for the campus's first admin, before there's an owner
 * around to approve one. An account signing up with a listed address is made an
 * active admin of the default school immediately, skipping both the request
 * queue and the school-domain rule.
 *
 * This is a bootstrap convenience, not a role: clearing the variable stops it
 * granting anything new, though accounts already created keep the campus until
 * an owner revokes them. Prefer the request queue once someone owns the site.
 */
export function isBootstrapAdmin(email: string): boolean {
  return allowlist("CLUBBASE_ADMIN_EMAILS").includes(email.trim().toLowerCase());
}

/**
 * True when nobody is configured to run the site. Surfaced in the UI so a fresh
 * deployment says "set CLUBBASE_OWNER_EMAILS" rather than silently having no way
 * to approve the first admin.
 */
export function ownersConfigured(): boolean {
  return allowlist("CLUBBASE_OWNER_EMAILS").length > 0;
}
