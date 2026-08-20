import Link from "next/link";
import { CheckCircle2, Inbox, Clock, PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import type { OverviewCounters } from "@/services/review/dashboard";

/**
 * States the single next thing to do, in priority order.
 *
 * The spec's UX principle is that the next action must be obvious; a grid
 * of counters does not do that on its own, because it leaves the reader to
 * work out which number is the one they can act on.
 */
export function NextAction({ counters, orgQuery }: { counters: OverviewCounters; orgQuery: string }) {
  if (counters.readyToSend > 0) {
    return (
      <Panel
        icon={CheckCircle2}
        tone="brand"
        title={`${counters.readyToSend} email${counters.readyToSend === 1 ? "" : "s"} ready to send`}
        body="These submissions are confirmed. Sending delivers them to each employee and copies in whoever wrote the feedback."
        cta={{ label: "Go to Submissions", href: `/submissions${orgQuery}` }}
      />
    );
  }

  if (counters.awaitingReview > 0) {
    return (
      <Panel
        icon={Inbox}
        tone="warning"
        title={`${counters.awaitingReview} submission${counters.awaitingReview === 1 ? "" : "s"} to review`}
        body="Open each one to read the feedback and preview the exact email, then confirm it or send it back for revision."
        cta={{ label: "Review submissions", href: `/submissions${orgQuery}` }}
      />
    );
  }

  if (counters.pending > 0) {
    return (
      <Panel
        icon={Clock}
        tone="neutral"
        title={`Waiting on feedback for ${counters.pending} ${counters.pending === 1 ? "person" : "people"}`}
        body="Department Heads submit for their own team. Departments still outstanding are listed below."
        cta={{ label: "See who is missing", href: `/submissions${orgQuery}` }}
      />
    );
  }

  return (
    <Panel
      icon={PartyPopper}
      tone="success"
      title="This cycle is complete"
      body="Every employee has feedback and every confirmed email has been sent."
      cta={{ label: "View email history", href: "/email-history" }}
    />
  );
}

const TONES = {
  brand: "border-brand/25 bg-brand-subtle text-brand",
  warning: "border-warning/25 bg-warning-subtle text-warning",
  success: "border-success/25 bg-success-subtle text-success",
  neutral: "border-border bg-muted text-muted-foreground",
} as const;

function Panel({
  icon: Icon,
  tone,
  title,
  body,
  cta,
}: {
  icon: typeof CheckCircle2;
  tone: keyof typeof TONES;
  title: string;
  body: string;
  cta: { label: string; href: string };
}) {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${TONES[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-section-title">{title}</p>
          <p className="text-page-subtitle mt-1">{body}</p>
        </div>
      </div>
      <Link href={cta.href} className={`${buttonVariants()} shrink-0`}>
        {cta.label}
      </Link>
    </Card>
  );
}
