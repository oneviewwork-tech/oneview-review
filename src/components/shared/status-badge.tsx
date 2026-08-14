import { Badge } from "@/components/ui/badge";
import type { SubmissionStatus } from "@prisma/client";

const STATUS: Record<SubmissionStatus, { label: string; variant: "warning" | "brand" | "success" }> = {
  SUBMITTED: { label: "Submitted", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "brand" },
  SENT: { label: "Sent", variant: "success" },
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const s = STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
