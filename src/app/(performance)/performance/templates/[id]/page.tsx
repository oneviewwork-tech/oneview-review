import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { PageHeader } from "@/components/shared/page-header";
import { TemplateDialog } from "@/components/performance/template-dialog";
import { VersionEditor, type EditorVersion } from "@/components/performance/version-editor";
import { requirePermission } from "@/lib/rbac";
import { formatPeriodValue, formatReviewPeriod, reviewPeriodForDate } from "@/domain/review/period";
import { cn } from "@/lib/utils";

export default async function TemplateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  await requirePermission("PERF_SETUP");
  const { id } = await params;
  const { version: versionParam } = await searchParams;

  const template = await prisma.perfTemplate.findUnique({
    where: { id },
    include: {
      _count: { select: { assignments: true } },
      versions: {
        orderBy: { effectiveFrom: "desc" },
        include: {
          kras: { orderBy: { sortOrder: "asc" }, include: { kpis: { orderBy: { sortOrder: "asc" } } } },
          risks: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!template) notFound();

  const now = reviewPeriodForDate(new Date());
  const latest = template.versions[0];
  const inForce = template.versions.find((v) => v.effectiveFrom <= now) ?? latest;
  const creating = versionParam === "new" || template.versions.length === 0;
  const source = creating ? latest : (template.versions.find((v) => v.id === versionParam) ?? inForce);

  // A new version starts as a copy of the latest one, minus the ids, so it
  // becomes brand-new KPIs and the old version's scores stay where they are.
  const strip = <T extends { id?: string }>(x: T, keep: boolean): T => (keep ? x : { ...x, id: undefined });
  const initial: EditorVersion = {
    id: creating ? undefined : source?.id,
    effectiveFrom: creating
      ? formatPeriodValue(latest && latest.effectiveFrom >= now ? new Date(Date.UTC(latest.effectiveFrom.getUTCFullYear(), latest.effectiveFrom.getUTCMonth() + 1, 1)) : now)
      : source
        ? formatPeriodValue(source.effectiveFrom)
        : formatPeriodValue(now),
    kras: (source?.kras ?? []).map((k) =>
      strip(
        {
          id: k.id,
          name: k.name,
          kpis: k.kpis.map((p) =>
            strip(
              {
                id: p.id,
                name: p.name,
                description: p.description ?? "",
                maxPoints: String(p.maxPoints),
                mode: p.mode,
                target: p.target == null ? "" : String(p.target),
                direction: p.direction ?? "HIGHER_IS_BETTER",
              },
              !creating
            )
          ),
        },
        !creating
      )
    ),
    risks: (source?.risks ?? []).map((r) =>
      strip({ id: r.id, category: r.category, name: r.name, description: r.description ?? "", alertLevel: r.alertLevel ?? "" }, !creating)
    ),
  };

  const hasScores = source && !creating ? (await prisma.perfScore.count({ where: { kpi: { kra: { versionId: source.id } } } })) > 0 : false;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Scorecard"
        title={template.name}
        description={`${template._count.assignments} ${template._count.assignments === 1 ? "person is" : "people are"} scored with this scorecard.`}
        actions={<TemplateDialog template={{ id: template.id, name: template.name, roleDefinition: template.roleDefinition, responsibilities: template.responsibilities }} />}
      />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="p-3">
          <p className="text-metadata mb-2 px-1">Versions</p>
          <ul className="space-y-1">
            {template.versions.map((v) => {
              const active = !creating && source?.id === v.id;
              return (
                <li key={v.id}>
                  <Link
                    href={`/performance/templates/${template.id}?version=${v.id}`}
                    className={cn("block rounded-lg px-3 py-2 text-sm transition-ui", active ? "bg-brand font-semibold text-brand-foreground" : "hover:bg-accent")}
                  >
                    From {formatReviewPeriod(v.effectiveFrom)}
                    {v.id === inForce?.id && <span className={cn("block text-xs", active ? "text-brand-foreground/80" : "text-muted-foreground")}>in force now</span>}
                  </Link>
                </li>
              );
            })}
            {creating && <li className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground">New version</li>}
          </ul>
          {!creating && (
            <Link href={`/performance/templates/${template.id}?version=new`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 w-full")}>
              <Plus className="size-3.5" /> New version
            </Link>
          )}
        </Card>

        <VersionEditor key={`${creating ? "new" : source?.id}`} templateId={template.id} initial={initial} hasScores={hasScores} />
      </div>
    </div>
  );
}
