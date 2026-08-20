import Link from "next/link";
import { Clock, Undo2, CheckCircle2, Send, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { OverviewCounters } from "@/services/review/dashboard";

/**
 * The product is one pipeline — Collect, Review, Confirm, Send — and this
 * is that pipeline made literal. Each submission sits in exactly one stage,
 * so the row reads as a funnel that drains left to right, and the stage
 * that currently needs a person is the one that carries emphasis.
 */
interface Stage {
  key: string;
  label: string;
  hint: string;
  count: number;
  icon: LucideIcon;
  href: string;
  tone: "neutral" | "warning" | "brand" | "success";
}

export function ReviewPipeline({ counters, orgQuery }: { counters: OverviewCounters; orgQuery: string }) {
  const stages: Stage[] = [
    {
      key: "collect",
      label: "Awaiting feedback",
      hint: "No submission yet this cycle",
      count: counters.pending,
      icon: Clock,
      href: `/submissions${orgQuery}`,
      tone: "neutral",
    },
    {
      key: "review",
      label: "To review",
      hint: "Submitted, waiting on HR",
      count: counters.awaitingReview,
      icon: Undo2,
      href: `/submissions${orgQuery}`,
      tone: "warning",
    },
    {
      key: "send",
      label: "Ready to send",
      hint: "Confirmed, not yet emailed",
      count: counters.readyToSend,
      icon: CheckCircle2,
      href: `/submissions${orgQuery}`,
      tone: "brand",
    },
    {
      key: "sent",
      label: "Sent",
      hint: "Delivered to the employee",
      count: counters.sent,
      icon: Send,
      href: `/email-history`,
      tone: "success",
    },
  ];

  // Exactly one stage is "live": the earliest one that still has work in
  // it, reading right to left in priority — sending what is ready beats
  // reviewing, which beats chasing missing feedback.
  const live =
    counters.readyToSend > 0 ? "send" : counters.awaitingReview > 0 ? "review" : counters.pending > 0 ? "collect" : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stages.map((stage) => {
        const active = stage.key === live;
        const Icon = stage.icon;
        return (
          <Card
            key={stage.key}
            className={cn(
              "group relative overflow-hidden p-4 transition-ui hover:elevation-raised",
              active && "ring-2 ring-brand/30"
            )}
          >
            <Link href={stage.href} className="absolute inset-0" aria-label={`${stage.label}: ${stage.count}`} />
            <div className="flex items-start justify-between gap-2">
              <p className="text-metadata">{stage.label}</p>
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  stage.tone === "warning" && "text-warning",
                  stage.tone === "brand" && "text-brand",
                  stage.tone === "success" && "text-success",
                  stage.tone === "neutral" && "text-muted-foreground"
                )}
                aria-hidden
              />
            </div>
            <p
              className={cn(
                "text-metric mt-1.5",
                stage.count === 0 && "text-muted-foreground",
                stage.count > 0 && stage.tone === "warning" && "text-warning",
                stage.count > 0 && stage.tone === "brand" && "text-brand",
                stage.count > 0 && stage.tone === "success" && "text-success"
              )}
            >
              {stage.count}
            </p>
            <p className="text-metadata mt-0.5">{stage.hint}</p>
          </Card>
        );
      })}
    </div>
  );
}
