import Image from "next/image";
import { AlertCircle, ArrowUpRight, CheckCircle2, MoreHorizontal } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
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
    "linear-gradient(30deg, rgb(8 102 255 / 0.035) 12%, transparent 12.5%, transparent 87%, rgb(8 102 255 / 0.035) 87.5%, rgb(8 102 255 / 0.035))," +
    "linear-gradient(150deg, rgb(8 102 255 / 0.035) 12%, transparent 12.5%, transparent 87%, rgb(8 102 255 / 0.035) 87.5%, rgb(8 102 255 / 0.035))," +
    "linear-gradient(30deg, rgb(8 102 255 / 0.035) 12%, transparent 12.5%, transparent 87%, rgb(8 102 255 / 0.035) 87.5%, rgb(8 102 255 / 0.035))," +
    "linear-gradient(150deg, rgb(8 102 255 / 0.035) 12%, transparent 12.5%, transparent 87%, rgb(8 102 255 / 0.035) 87.5%, rgb(8 102 255 / 0.035))",
  backgroundSize: "56px 98px",
  backgroundPosition: "0 0, 0 0, 28px 49px, 28px 49px",
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

  // Full bleed: the two panels are the page, with no canvas framing them.
  // Height comes from the content, so a normal screen needs no scrolling
  // and a very short one (heavy browser zoom) scrolls the page rather than
  // clipping a panel or growing a scrollbar inside the form.
  return (
    <div className="grid min-h-screen grid-rows-[auto_minmax(0,1fr)] bg-card wide:grid-cols-2 wide:grid-rows-1">
        {/* ── Hero band, phone and tablet only ─────────────────────── */}
        <div className="relative flex h-[148px] items-center justify-center overflow-hidden bg-ink wide:hidden">
          <div className="absolute inset-0 opacity-[0.35]" style={PATTERN} />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "radial-gradient(22rem circle at 50% 120%, rgb(8 102 255 / 0.55), transparent 70%)" }}
          />
          <span className="relative flex flex-col items-center gap-2.5">
            <Image src="/oneview-review-mark.png" alt="" width={44} height={44} priority className="size-11 rounded-xl" />
            <span className="text-lg font-black tracking-tight text-ink-foreground">
              ONEVIEW <span className="font-semibold text-ink-foreground/60">Review</span>
            </span>
          </span>
        </div>

        {/* ── Sign-in panel ────────────────────────────────────────── */}
        {/* Header, form and footer share one column so they line up on the
            same left edge, whatever the panel's width. On phones the panel
            is the white sheet that laps over the hero above it. */}
        <div className="relative z-10 -mt-6 mx-auto flex w-full max-w-[440px] flex-col items-center overflow-hidden rounded-t-[1.75rem] bg-card px-7 pb-8 pt-7 text-center sm:px-10 wide:mt-0 wide:max-w-none wide:items-start wide:rounded-none wide:bg-surface-sunken wide:px-12 wide:pt-12 wide:text-left">
          <div aria-hidden className="absolute inset-0 z-0 hidden wide:block" style={PATTERN} />
          <header className="relative z-10 hidden wide:flex">
            <BrandLogo brand="all" />
          </header>

          {/* The handoff sits above the form on desktop but below it on a
              phone, where the primary action belongs under the fields -
              hence the ordering rather than two copies of the markup.
              On desktop this is a short, bordered card right under the
              header - not a block stretched to fill the column's height. */}
          <main className="relative z-10 flex flex-1 flex-col items-center justify-center py-5 wide:flex-none wide:items-start wide:justify-start wide:py-0">
            <div className="animate-fade-up flex w-full flex-col items-center wide:mt-7 wide:w-[380px] wide:items-stretch wide:rounded-2xl wide:border wide:border-border wide:bg-card wide:p-6 wide:shadow-sm">
              <div className="order-1 text-center wide:text-left">
                <h1 className="text-[clamp(1.6rem,3.4vw,2.25rem)] font-black leading-[1.1] tracking-tight wide:text-[1.5rem]">
                  Login to Your Account!
                </h1>
                <p className="mt-2 text-sm text-muted-foreground wide:hidden">
                  Score your team, confirm the month and send feedback &mdash; all in one place.
                </p>
              </div>

              {passwordChanged && (
                <p role="status" className="order-2 mt-5 flex items-center gap-2 rounded-xl border border-success/25 bg-success-subtle px-3 py-2.5 text-sm text-success">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Password updated. Sign in with your new password.
                </p>
              )}
              {sso && (
                <p role="alert" className="order-2 mt-5 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive-subtle px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {SSO_ERRORS[sso] ?? SSO_ERRORS.invalid}
                </p>
              )}

              {handoff && (
                <div className="order-5 wide:order-3">
                  <a
                    href={handoff}
                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-[14px] font-semibold text-foreground transition hover:bg-accent"
                  >
                    Continue with ONEVIEW People
                    <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                  <p className="mt-2.5 text-center text-xs text-muted-foreground">
                    Already signed in to People? This brings you straight in.
                  </p>
                </div>
              )}

              {handoff && (
                <div className="order-4 my-4 flex items-center gap-3 text-xs font-semibold tracking-wide text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  - OR -
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}

              <div className="order-3 mt-6 wide:order-5 wide:mt-0">
                <LoginForm />
              </div>

              <p className="order-6 mt-5 text-center text-sm text-muted-foreground wide:text-left">
                Don&apos;t have an account? <span className="font-bold text-foreground">Ask your HR team</span>
              </p>
            </div>
          </main>
        </div>

        {/* ── Showcase panel ───────────────────────────────────────── */}
        <aside aria-hidden className="relative hidden h-full flex-col justify-center overflow-hidden bg-surface-sunken wide:flex">
          <div className="absolute inset-0" style={PATTERN} />
          {/* Lifts the cards off the texture so they read as one stack. */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-brand/[0.07]" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-end gap-5 px-9 pt-9 text-sm font-medium text-muted-foreground">
            <span>Performance</span>
            <span>Feedback</span>
            <span className="font-semibold text-foreground">Reviews</span>
          </div>

          {/* The cards overlap on purpose, so they have to flow rather than
              sit at fixed offsets - at this panel's width (roughly half of
              1024px at the lg breakpoint) absolute placement collided. Each
              one hangs off the row above it by a set amount, alternating
              side, and later cards stack over earlier ones. */}
          <div className="relative flex flex-col px-8 py-10 [zoom:0.9] wide:px-10 [@media(max-height:820px)]:[zoom:0.72]">
            {/* Week scoring, with the team who still owe a score. */}
            <div className="z-10 w-[86%] max-w-[330px] self-end rounded-2xl bg-card p-5 shadow-[0_18px_40px_-22px_rgb(15_23_42_/_0.4)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">16 – 21 Nov</p>
                  <p className="mt-0.5 text-lg font-bold tracking-tight">Week 3 scoring</p>
                </div>
                <MoreHorizontal className="size-5 shrink-0 text-muted-foreground" />
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
            <div className="z-20 -mt-5 w-[90%] max-w-[340px] self-start rounded-2xl bg-ink p-6 text-ink-foreground shadow-[0_24px_55px_-22px_rgb(15_23_42_/_0.6)]">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand/90">
                <span className="size-3 rounded-full bg-ink-foreground" />
              </span>
              <p className="mt-5 text-[2.1rem] font-black leading-none tracking-tight">86.2</p>
              <p className="mt-1.5 text-sm text-ink-foreground/70">Month score &middot; A &mdash; High Performer</p>
              <div className="mt-6 flex items-center justify-between text-sm text-ink-foreground/60">
                <span className="tracking-[0.3em]">W1 W2 W3</span>
                <span className="text-ink-foreground">Nov 26</span>
              </div>
            </div>

            {/* Week-by-week, the shape the dashboard draws. Tucked under the
                dark card's bottom-right corner, as in the reference. */}
            <div className="z-30 -mt-7 mr-2 w-[66%] max-w-[250px] self-end rounded-2xl bg-card p-5 shadow-[0_18px_40px_-22px_rgb(15_23_42_/_0.4)]">
              <div className="flex h-[72px] items-end justify-between gap-2">
                {WEEK_BARS.map((b) => (
                  <span
                    key={b.label}
                    style={{ height: `${b.height}px` }}
                    className={["w-5 rounded-md", b.on ? "bg-brand" : "bg-muted"].join(" ")}
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
            <div className="z-40 -mt-4 w-[94%] max-w-[360px] self-start rounded-2xl bg-card p-5 shadow-[0_18px_40px_-22px_rgb(15_23_42_/_0.4)]">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-black text-ink-foreground">
                  R
                </span>
                <p className="min-w-0 flex-1 truncate font-bold tracking-tight">ONEVIEW Review</p>
                <p className="shrink-0 text-xs text-muted-foreground">2 min ago</p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Week 3 is confirmed and on its way to HR. 🎉</p>
              <div className="mt-4 flex justify-end border-t border-border pt-3">
                <span className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-xs font-bold text-brand-foreground">
                  Open Review
                </span>
              </div>
            </div>
          </div>
        </aside>
    </div>
  );
}
