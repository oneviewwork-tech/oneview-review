import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { formatReviewPeriod } from "@/domain/review/period";

export default async function EmailHistoryPage() {
  const sent = await prisma.feedbackSubmission.findMany({
    where: { status: "SENT" },
    orderBy: { sentAt: "desc" },
  });

  return (
    <div className="animate-fade-up">
      <h1 className="text-page-title">Email History</h1>
      <p className="text-page-subtitle mt-1">Every performance review email that has been sent.</p>

      {sent.length === 0 ? (
        <EmptyState className="mt-6" title="No emails sent yet" description="Sent emails will appear here once submissions are confirmed and delivered." />
      ) : (
        <Card className="mt-6 overflow-x-auto p-0">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-metadata">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Template</th>
                <th className="px-4 py-2.5 font-medium">Sent At</th>
                <th className="px-4 py-2.5 font-medium">Message ID</th>
              </tr>
            </thead>
            <tbody>
              {sent.map((s) => (
                <tr key={s.id} className="border-b border-border-subtle transition-ui last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <Link href={`/submissions/${s.id}`} className="hover:text-brand hover:underline">
                      {s.employeeName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.departmentName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatReviewPeriod(s.reviewPeriod)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">Template {s.templateType}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.sentAt?.toLocaleString() ?? "-"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{s.resendMessageId ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
