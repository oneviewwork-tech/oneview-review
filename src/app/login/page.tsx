import Image from "next/image";
import { AlertCircle, ArrowUpRight, CheckCircle2, KeyRound, TrendingUp, Users } from "lucide-react";
import { LoginForm } from "./login-form";

/** People's own sign-in hands the employee straight over (see /sso). */
const peopleHandoffUrl = () => {
  const base = process.env.PEOPLE_APP_URL?.replace(/\/+$/, "");
  return base ? `${base}/api/sso/review` : null;
};

const SSO_ERRORS: Record<string, string> = {
  expired: "That sign-in link from ONEVIEW People has expired. Open Performance from People again.",
  invalid: "We couldn't verify that sign-in link. Open Performance from People again, or sign in below.",
  inactive: "Your account isn't active in ONEVIEW Review. Contact your HR team.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string; sso?: string }>;
}) {
  const { passwordChanged, sso } = await searchParams;
  const handoff = peopleHandoffUrl();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eceaf8] px-4 py-8 sm:px-8">
      {/* Soft colour wash behind the frosted frame. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(40rem circle at 12% 18%, rgba(139,109,255,0.45), transparent 60%)," +
            "radial-gradient(36rem circle at 88% 12%, rgba(244,114,182,0.32), transparent 60%)," +
            "radial-gradient(42rem circle at 70% 95%, rgba(96,165,250,0.35), transparent 60%)",
        }}
      />

      <div className="relative grid w-full max-w-[1080px] gap-3 rounded-[2.25rem] border border-white/70 bg-white/45 p-3 shadow-[0_30px_80px_-30px_rgba(42,26,110,0.35)] backdrop-blur-2xl lg:grid-cols-2">
        {/* ── Visual panel ─────────────────────────────────────────── */}
        <aside className="relative hidden min-h-[560px] overflow-hidden rounded-[1.75rem] p-8 lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(28rem circle at 20% 10%, #a78bfa 0%, transparent 60%)," +
                "radial-gradient(26rem circle at 95% 35%, #f9a8d4 0%, transparent 55%)," +
                "radial-gradient(30rem circle at 30% 100%, #bfdbfe 0%, transparent 60%)," +
                "linear-gradient(160deg, #c4b5fd 0%, #e9d5ff 45%, #dbeafe 100%)",
            }}
          />

          <div className="relative flex items-center gap-2.5">
            <Image src="/oneview-review-mark.png" alt="" width={36} height={36} priority className="size-9 rounded-xl shadow-sm" />
            <span className="text-sm font-bold tracking-tight text-ink">
              Haris&amp;Co. <span className="text-ink/40">&times;</span> HACA
            </span>
          </div>

          {/* Wordmark with a glass orb resting on it. */}
          <div className="relative -mx-2 select-none" aria-hidden>
            <p className="text-[5.4rem] font-black uppercase leading-[0.85] tracking-[-0.06em] text-white">ONEVIEW</p>
            <p className="mt-1 pl-1 text-right text-sm font-semibold uppercase tracking-[0.5em] text-white/90">Review</p>
            <div
              className="absolute left-[46%] top-[-2.5rem] size-36 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 22%)," +
                  "radial-gradient(circle at 50% 50%, rgba(244,114,182,0.85) 0%, rgba(167,139,250,0.75) 55%, rgba(45,212,191,0.65) 100%)",
                boxShadow: "inset -10px -18px 30px rgba(91,61,245,0.35), inset 8px 10px 20px rgba(255,255,255,0.6), 0 24px 50px -12px rgba(91,61,245,0.45)",
                backdropFilter: "blur(6px)",
              }}
            />
          </div>

          <div className="relative">
            <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight text-ink">Performance &amp; feedback, together</h1>
            <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink/70">
              Score your team week by week, confirm results, and send feedback, all in one place for Haris&amp;Co. and HACA.
            </p>
          </div>
        </aside>

        {/* ── Sign-in column ───────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <main className="flex flex-1 items-center rounded-[1.75rem] border border-white/80 bg-white/70 px-6 py-10 sm:px-12">
            <div className="mx-auto w-full max-w-[380px] animate-fade-up">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <Image src="/oneview-review-mark.png" alt="" width={28} height={28} priority className="size-7 rounded-lg" />
              </span>

              <h2 className="mt-6 text-[1.9rem] font-bold tracking-tight">Welcome back</h2>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to ONEVIEW Review.</p>

              <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-subtle px-3 py-2.5 text-[13px] text-ink">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-brand" />
                <span>
                  Use the <strong>same email and password as ONEVIEW People</strong>. There&apos;s no separate Review password.
                </span>
              </p>

              {passwordChanged && (
                <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-success/25 bg-success-subtle px-3 py-2.5 text-sm text-success">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Password updated. Sign in with your new password.
                </p>
              )}
              {sso && (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive-subtle px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {SSO_ERRORS[sso] ?? SSO_ERRORS.invalid}
                </p>
              )}

              <div className="mt-6">
                <LoginForm />
              </div>

              {handoff && (
                <>
                  <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    Or continue with
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <a
                    href={handoff}
                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-semibold shadow-xs transition-ui hover:border-brand/40 hover:bg-brand-subtle"
                  >
                    ONEVIEW People
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                </>
              )}

              <p className="mt-6 text-center text-xs text-muted-foreground">Trouble signing in? Contact your HR team.</p>
            </div>
          </main>

          {/* Bottom strip, as in the family's other apps. */}
          <div className="flex items-center gap-3 rounded-[1.5rem] border border-white/80 bg-white/70 px-5 py-4">
            <div className="flex -space-x-2">
              {/* People and Review: one account across both. */}
              <span className="flex size-9 items-center justify-center rounded-full bg-sky-400 text-white ring-2 ring-white">
                <Users className="size-4" />
              </span>
              <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-chart-pink text-white ring-2 ring-white">
                <TrendingUp className="size-4" />
              </span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">One login for ONEVIEW People &amp; Review</p>
              <p className="text-xs text-muted-foreground">Already signed in to People? Open Performance there to come straight in.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
