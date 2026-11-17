import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TemplateDialog } from "@/components/performance/template-dialog";
import { requirePermission } from "@/lib/rbac";
import { formatReviewPeriod } from "@/domain/review/period";

export default async function TemplatesPage() {
  await requirePermission("PERF_SETUP");
  const templates = await prisma.perfTemplate.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { assignments: true, versions: true } },
      versions: { orderBy: { effectiveFrom: "desc" }, take: 1, select: { effectiveFrom: true } },
    },
  });

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Scorecards"
        description="One scorecard per role: its KRAs, KPIs and weights. Changing KPIs means adding a version from a month, so past scores never move."
        actions={<TemplateDialog />}
      />

      {templates.length === 0 ? (
        <EmptyState className="mt-5" title="No scorecards yet" description="Create one for each role you score, then assign people to it." />
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Link key={t.id} href={`/performance/templates/${t.id}`}>
              <Card interactive className="h-full p-4">
                <p className="font-semibold">{t.name}</p>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                  {t.roleDefinition ?? "No role definition yet."}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t._count.assignments} {t._count.assignments === 1 ? "person" : "people"} · {t._count.versions}{" "}
                  {t._count.versions === 1 ? "version" : "versions"}
                  {t.versions[0] && ` · latest from ${formatReviewPeriod(t.versions[0].effectiveFrom)}`}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
