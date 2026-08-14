import { Badge } from "@/components/ui/badge";
import type { SubmissionStatus } from "@prisma/client";

const STATUS: Record<SubmissionStatus, { label: string; variant: "warning" | "brand" | "success" | "revision" }> = {
  SUBMITTED: { label: "Submitted", variant: "warning" },
  NEEDS_REVISION: { label: "Needs Revision", variant: "revision" },
  CONFIRMED: { label: "Confirmed", variant: "brand" },
  SENT: { label: "Sent", variant: "success" },
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const s = STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
