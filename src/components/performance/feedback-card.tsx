import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatReviewPeriod } from "@/domain/review/period";
import type { PersonFeedbackItem } from "@/services/performance/feedback";

/** A person's feedback history, as part of their Performance page. */
export function FeedbackCard({ items }: { items: PersonFeedbackItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="p-4">
      <p className="text-metadata mb-3 flex items-center gap-1.5">
        <MessageSquareText className="size-3.5" /> Feedback
      </p>
      <ul className="space-y-3 text-sm">
        {items.map((f) => (
          <li key={f.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{formatReviewPeriod(f.reviewPeriod)}</span>
              <StatusBadge status={f.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              From {f.submittedBy} · template {f.templateType}
            </p>
            {f.feedback && <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap leading-relaxed">{f.feedback}</p>}
            {f.canOpen && (
              <Link href={`/submissions/${f.id}`} className="mt-1.5 inline-block text-xs text-brand hover:underline">
                Open review
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
