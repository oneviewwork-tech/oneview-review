import Image from "next/image";
import { CheckCircle2, Lock, ShieldCheck, ScrollText } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string }>;
}) {
  const { passwordChanged } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel. Hidden on small screens, where it would push the form
          below the fold on a phone. */}
      <aside className="relative hidden overflow-hidden bg-[#0b2a6b] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px circle at 18% 12%, rgba(56,132,255,0.55), transparent 55%)," +
              "radial-gradient(700px circle at 85% 78%, rgba(13,148,136,0.45), transparent 55%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <Image
            src="/oneview-review-mark.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-10 w-10 rounded-xl shadow-sm"
          />
          <span aria-hidden className="h-6 w-px bg-white/25" />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">Haris&amp;Co.</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
              ONEVIEW Review
            </p>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-[2.75rem] font-bold leading-[1.08] tracking-tight">
            Performance
            <br />
            feedback,
            <br />
            without the
            <br />
            inbox.
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
            Department Heads submit once. HR reviews, confirms, and sends every
            email in a single action.
          </p>
        </div>

        <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/65">
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Role-based access
          </li>
          <li className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Department-scoped data
          </li>
          <li className="flex items-center gap-1.5">
            <ScrollText className="h-3.5 w-3.5" />
            Audit logging enabled
          </li>
        </ul>
      </aside>

      <main className="relative flex items-center justify-center bg-background px-4 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[400px] animate-fade-up">
          {/* Standing in for the brand panel on small screens. */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Image
              src="/oneview-review-mark.png"
              alt=""
              width={36}
              height={36}
              priority
              className="h-9 w-9 rounded-lg ring-1 ring-border"
            />
            <span className="text-[15px] font-bold tracking-tight">
              ONEVIEW <span className="font-semibold text-muted-foreground">Review</span>
            </span>
          </div>

          <h2 className="text-[1.75rem] font-bold tracking-tight">Welcome back</h2>
          <p className="text-page-subtitle mt-1.5">Sign in to continue to your ONEVIEW workspace.</p>

          {passwordChanged && (
            <p
              role="status"
              className="mt-5 flex items-center gap-2 rounded-lg border border-success/25 bg-success-subtle px-3 py-2.5 text-sm text-success"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Password updated. Sign in with your new password.
            </p>
          )}

          <div className="mt-6">
            <LoginForm />
          </div>

          <p className="mt-8 text-center text-metadata">
            Trouble signing in? Contact your HR team or system administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
