import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MailCheck, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { homeFor } from "@/lib/campus-data";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/verify-email")({
  head: () => ({
    meta: [
      { title: "Confirm your email — ClubBase" },
      {
        name: "description",
        content:
          "Enter the six-digit code we emailed you to finish setting up your ClubBase account.",
      },
      { property: "og:title", content: "Confirm your email — ClubBase" },
      { property: "og:description", content: "One code stands between you and your campus." },
    ],
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { ready, session, emailInConsoleMode, verifyEmail, resendVerification, signOut } =
    useSession();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!session) navigate({ to: "/", replace: true });
    else if (session.emailVerified) navigate({ to: homeFor(session), replace: true });
  }, [ready, session, navigate]);

  if (!ready || !session || session.emailVerified) return null;

  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-6 py-12">
      <div className="card-surface w-full max-w-md p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="size-7" />
        </span>
        <h1 className="mt-4 text-3xl">Confirm your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a six-digit code to <span className="font-semibold">{session.email}</span>. Enter
          it to finish setting up your account — nothing else works until you do.
        </p>

        {emailInConsoleMode && (
          <p className="mt-4 flex items-start gap-2 rounded-md bg-secondary px-3 py-2 text-left text-xs text-muted-foreground">
            <Terminal className="mt-0.5 size-4 shrink-0" />
            <span>
              No mail provider is configured, so this code was printed in the terminal running{" "}
              <code className="font-semibold">npm run dev</code>. That fallback is refused in
              production.
            </span>
          </p>
        )}

        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setNotice("");
            const problem = await verifyEmail(code);
            setBusy(false);
            setError(problem ?? "");
            if (!problem) setCode("");
          }}
        >
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Six-digit code"
            placeholder="000000"
            className="w-full rounded-md border border-input bg-card px-3 py-3 text-center font-display text-3xl tracking-[0.4em] outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-success">{notice}</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Checking…" : "Confirm email"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <button
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError("");
              const problem = await resendVerification();
              setBusy(false);
              setError(problem ?? "");
              setNotice(problem ? "" : "A new code is on its way.");
            }}
            className="font-semibold text-primary underline underline-offset-2"
          >
            Send a new code
          </button>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/", replace: true });
            }}
            className="text-muted-foreground underline underline-offset-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
