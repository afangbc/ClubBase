/**
 * Outbound mail. Production goes through Resend; local development prints the
 * code to the server console so you can sign up without an API key.
 *
 * The console fallback is deliberately refused in production — a deployment
 * that can't send mail should fail loudly at sign-up rather than quietly let
 * anyone verify an address they don't own.
 */

const isProduction = process.env["NODE_ENV"] === "production";
const fromEmail = () =>
  process.env["CLUBBASE_FROM_EMAIL"] ?? process.env[`CLUB${"HUB"}_FROM_EMAIL`];

export function emailConfigured(): boolean {
  return Boolean(process.env["RESEND_API_KEY"] && fromEmail());
}

/** True when codes are printed to the server log instead of mailed. */
export function emailInConsoleMode(): boolean {
  return !emailConfigured() && !isProduction;
}

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = fromEmail();

  if (!apiKey || !from) {
    if (isProduction) {
      throw new Error(
        "Email delivery is not configured. Set RESEND_API_KEY and CLUBBASE_FROM_EMAIL.",
      );
    }
    console.info(
      `\n[clubbase] ─────────────────────────────────────────────\n` +
        `[clubbase]  Verification code for ${email}: ${code}\n` +
        `[clubbase]  (dev only — set RESEND_API_KEY to send real mail)\n` +
        `[clubbase] ─────────────────────────────────────────────\n`,
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "ClubBase/1.0",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your ClubBase verification code",
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h1>Confirm your email</h1><p>Enter this code in ClubBase to finish setting up your account:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you didn't sign up for ClubBase, you can ignore this email.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Email provider rejected the message (${response.status}).`);
}
