import Image from "next/image";
import { AlertCircle, ArrowUpRight, CheckCircle2, MoreHorizontal } from "lucide-react";
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

/** The faint isometric texture behind the showcase panel. */
const PATTERN = {
  backgroundImage:
    "linear-gradient(30deg, rgb(91 61 245 / 0.05) 12%, transparent 12.5%, transparent 87%, rgb(91 61 245 / 0.05) 87.5%, rgb(91 61 245 / 0.05))," +
    "linear-gradient(150deg, rgb(91 61 245 / 0.05) 12%, transparent 12.5%, transparent 87%, rgb(91 61 245 / 0.05) 87.5%, rgb(91 61 245 / 0.05))," +
    "linear-gradient(30deg, rgb(91 61 245 / 0.05) 12%, transparent 12.5%, transparent 87%, rgb(91 61 245 / 0.05) 87.5%, rgb(91 61 245 / 0.05))," +
    "linear-gradient(150deg, rgb(91 61 245 / 0.05) 12%, transparent 12.5%, transparent 87%, rgb(91 61 245 / 0.05) 87.5%, rgb(91 61 245 / 0.05))",
  backgroundSize: "48px 84px",
  backgroundPosition: "0 0, 0 0, 24px 42px, 24px 42px",
};

const WEEK_BARS = [
  { label: "W1", height: 44, on: false },
  { label: "W2", height: 28, on: false },
  { label: "W3", height: 62, on: true },
  { label: "W4", height: 36, on: false },
  { label: "W5", height: 20, on: false },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string; sso?: string }>;
}) {
  const { passwordChanged, sso } = await searchParams;
  const handoff = peopleHandoffUrl();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-6 sm:px-8 sm:py-10">
      <div className="grid w-full max-w-[1200px] overflow-hidden rounded-[2rem] bg-card shadow-[0_30px_80px_-40px_rgb(42_26_110_/_0.45)] lg:grid-cols-2">
        {/* ── Sign-in panel ────────────────────────────────────────── */}
        <div className="flex flex-col px-7 py-9 sm:px-12 sm:py-11">
          <header className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="flex items-center gap-2.5">
              <Image src="/oneview-review-mark.png" alt="" width={32} height={32} priority className="size-8 rounded-lg" />
              <span className="text-lg font-black tracking-tight">
                ONEVIEW <span className="font-semibold text-muted-foreground">Review</span>
              </span>
            </span>
            <span className="text-sm text-muted-foreground">Haris&amp;Co. &middot; HACA</span>
          </header>

          <main className="flex flex-1 flex-col justify-center py-10">
            <div className="animate-fade-up mx-auto w-full max-w-[420px]">
              <h1 className="text-[clamp(1.9rem,4vw,2.6rem)] font-black leading-[1.1] tracking-tight">
                Login to Your Account!
              </h1>

              {passwordChanged && (
                <p role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-success/25 bg-success-subtle px-3 py-2.5 text-sm text-success">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Password updated. Sign in with your new password.
                </p>
              )}
              {sso && (
                <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive-subtle px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {SSO_ERRORS[sso] ?? SSO_ERRORS.invalid}
                </p>
              )}

              {handoff && (
                <>
                  <a
                    href={handoff}
                    className="group mt-7 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-bold text-ink-foreground shadow-[4px_4px_0_0_var(--brand)] transition-ui hover:shadow-[2px_2px_0_0_var(--brand)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                  >
                    Continue with ONEVIEW People
                    <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                  <p className="mt-2.5 text-center text-xs text-muted-foreground">
                    Already signed in to People? This brings you straight in.
                  </p>

                  <div className="my-7 flex items-center gap-3 text-xs font-semibold tracking-wide text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    - OR -
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              <div className={handoff ? "" : "mt-7"}>
                <LoginForm />
              </div>

              <p className="mt-6 text-sm text-muted-foreground">
                Don&apos;t have an account? <span className="font-bold text-foreground">Ask your HR team</span>
              </p>
            </div>
          </main>

          <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>Same login as ONEVIEW People</span>
            <span aria-hidden className="text-border">|</span>
            <span>No separate Review password</span>
          </footer>
        </div>

        {/* ── Showcase panel ───────────────────────────────────────── */}
        <aside aria-hidden className="relative hidden min-h-[660px] overflow-hidden bg-surface-sunken lg:block">
          <div className="absolute inset-0" style={PATTERN} />

          <div className="absolute right-8 top-9 flex items-center gap-5 text-sm font-medium text-muted-foreground">
            <span>Performance</span>
            <span>Feedback</span>
            <span className="font-semibold text-foreground">Reviews</span>
          </div>

          {/* Week scoring, with the team who still owe a score. */}
          <div className="absolute right-7 top-[22%] w-[320px] rounded-2xl bg-card p-5 shadow-[0_20px_50px_-24px_rgb(42_26_110_/_0.45)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">16 – 21 Nov</p>
                <p className="mt-0.5 text-lg font-bold tracking-tight">Week 3 scoring</p>
              </div>
              <MoreHorizontal className="size-5 text-muted-foreground" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex -space-x-2.5">
                {["AN", "SK", "RP"].map((initials, i) => (
                  <span
                    key={initials}
                    className={[
                      "flex size-10 items-center justify-center rounded-full text-xs font-bold text-white ring-[3px] ring-card",
                      ["bg-brand", "bg-chart-pink", "bg-chart-blue"][i],
                    ].join(" ")}
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <span className="flex size-12 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
                +8
              </span>
            </div>
          </div>

          {/* The month's confirmed score, as the scorecard shows it. */}
          <div className="absolute left-[14%] top-[40%] w-[330px] rounded-2xl bg-ink p-6 text-ink-foreground shadow-[0_26px_60px_-24px_rgb(42_26_110_/_0.6)]">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand/90">
              <span className="size-3 rounded-full bg-ink-foreground" />
            </span>
            <p className="mt-5 text-[2.1rem] font-black leading-none tracking-tight">86.2</p>
            <p className="mt-1.5 text-sm text-ink-foreground/70">Month score · A &mdash; High Performer</p>
            <div className="mt-6 flex items-center justify-between text-sm tracking-[0.3em] text-ink-foreground/60">
              <span>W1 W2 W3</span>
              <span className="tracking-normal text-ink-foreground">Nov 26</span>
            </div>
          </div>

          {/* Week-by-week, the shape the dashboard draws. */}
          <div className="absolute bottom-[23%] left-7 w-[260px] rounded-2xl bg-card p-5 shadow-[0_20px_50px_-24px_rgb(42_26_110_/_0.45)]">
            <div className="flex h-[76px] items-end justify-between gap-2.5">
              {WEEK_BARS.map((b) => (
                <span
                  key={b.label}
                  style={{ height: `${b.height}px` }}
                  className={["w-6 rounded-md", b.on ? "bg-brand" : "bg-muted"].join(" ")}
                />
              ))}
            </div>
            <div className="mt-2.5 flex justify-between text-xs text-muted-foreground">
              {WEEK_BARS.map((b) => (
                <span key={b.label} className={b.on ? "font-bold text-foreground" : ""}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* What lands in the bell when a month is confirmed. */}
          <div className="absolute bottom-8 right-7 w-[360px] rounded-2xl bg-card p-5 shadow-[0_20px_50px_-24px_rgb(42_26_110_/_0.45)]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-ink text-sm font-black text-ink-foreground">R</span>
              <p className="flex-1 font-bold tracking-tight">ONEVIEW Review</p>
              <p className="text-xs text-muted-foreground">2 min ago</p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Week 3 is confirmed and on its way to HR. 🎉
            </p>
            <div className="mt-4 border-t border-border pt-3 text-right">
              <span className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-xs font-bold text-brand-foreground">
                Open Review
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
