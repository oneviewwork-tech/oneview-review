"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { ForbiddenError, requirePermission } from "@/lib/rbac";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { parseReviewPeriod } from "@/domain/review/period";
import { scoreWeek } from "@/domain/performance/engine";
import { canEditScores } from "@/domain/performance/workflow";
import { weekLockReason } from "@/domain/performance/weeks";
import { getPerformanceAccess, canScore } from "@/services/performance/access";
import { getVersionForPeriod, kpiDefsOf, MAX_WEEKS } from "@/services/performance/data";
import { assignmentSchema, templateDetailsSchema, versionSchema } from "@/validators/performance";

function parseMonth(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(Number(m[1]), month - 1, 1));
}

/**
 * Saves one person's scores for one week.
 *
 * Permission is re-derived here from the assignment tree — the form only
 * ever lists people the caller scores, but that is presentation. A blank
 * field clears that KPI's score, so a mistaken entry can be undone.
 */
export async function saveWeekScores(
  _prev: ActionResult<{ total: number }> | undefined,
  formData: FormData
): Promise<ActionResult<{ total: number }>> {
  const access = await getPerformanceAccess();
  const employeeId = String(formData.get("employeeId") ?? "");
  const week = Number(formData.get("week"));
  const period = parseReviewPeriod(String(formData.get("period") ?? ""));

  if (!period) return fail("That month is not valid.");
  if (!Number.isInteger(week) || week < 1 || week > MAX_WEEKS) return fail("Pick a week from 1 to " + MAX_WEEKS + ".");
  if (!canScore(access, employeeId)) throw new ForbiddenError("You do not score this person.");

  const [assignment, existingReview] = await Promise.all([
    prisma.perfAssignment.findUnique({ where: { employeeId } }),
    prisma.perfReview.findUnique({ where: { employeeId_period: { employeeId, period } }, select: { status: true } }),
  ]);
  if (!assignment) return fail("This person has no scorecard assigned yet.");
  // Once a month is with the reviewer (or confirmed) it is theirs to decide;
  // changing the numbers underneath them would defeat the review.
  if (existingReview && !canEditScores(existingReview.status)) {
    return fail(
      existingReview.status === "CONFIRMED"
        ? "This month is confirmed and locked."
        : "This month is with the reviewer. You can edit it again if they send it back."
    );
  }
  const version = await getVersionForPeriod(assignment.templateId, period);
  if (!version) return fail("No scorecard is in force for that month yet.");

  const kpis = kpiDefsOf(version);
  const entries: { kpiId: string; value: number; remark: string | null }[] = [];
  const clears: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  for (const kpi of kpis) {
    const raw = String(formData.get(`value_${kpi.id}`) ?? "").trim();
    const remark = String(formData.get(`remark_${kpi.id}`) ?? "").trim().slice(0, 500) || null;
    if (raw === "") {
      clears.push(kpi.id);
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || (kpi.mode === "RATING" && value > kpi.maxPoints)) {
      fieldErrors[`value_${kpi.id}`] = [kpi.mode === "RATING" ? `Enter 0 to ${kpi.maxPoints}.` : "Enter a number of 0 or more."];
      continue;
    }
    entries.push({ kpiId: kpi.id, value, remark });
  }
  if (Object.keys(fieldErrors).length > 0) return fail("Some scores are out of range.", fieldErrors);

  // Weeks go in order, Monday to Saturday: a week opens once it has started
  // and the one before it has every KPI scored, not just some of them -
  // otherwise a single field saved by accident would unlock the rest of the
  // month. Emptying a week is still blocked by any later score at all
  // (even a partial one), so the record never ends up with a gap.
  const existingByWeek = new Map<number, Set<string>>();
  for (const s of await prisma.perfScore.findMany({ where: { employeeId, period }, select: { week: true, kpiId: true } })) {
    const ids = existingByWeek.get(s.week) ?? new Set<string>();
    ids.add(s.kpiId);
    existingByWeek.set(s.week, ids);
  }
  const completeWeeks = new Set([...existingByWeek].filter(([, ids]) => ids.size >= kpis.length).map(([w]) => w));
  const locked = weekLockReason(period, week, completeWeeks);
  if (locked) return fail(locked);
  if (entries.length === 0 && [...existingByWeek.keys()].some((w) => w > week)) {
    return fail(`Week ${week} can't be left empty while later weeks have scores.`);
  }

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { name: true } });

  await prisma.$transaction(async (tx) => {
    if (clears.length > 0) {
      await tx.perfScore.deleteMany({ where: { employeeId, period, week, kpiId: { in: clears } } });
    }
    for (const e of entries) {
      await tx.perfScore.upsert({
        where: { employeeId_kpiId_period_week: { employeeId, kpiId: e.kpiId, period, week } },
        create: {
          employeeId,
          kpiId: e.kpiId,
          period,
          week,
          value: e.value,
          remark: e.remark,
          enteredById: access.user.id,
          enteredByName: access.user.name,
        },
        update: { value: e.value, remark: e.remark, enteredById: access.user.id, enteredByName: access.user.name },
      });
    }
    await writeAuditEvent(tx, {
      entityType: "PerfScore",
      entityId: employeeId,
      action: "PERF_SCORE_SAVED",
      actorUserId: access.user.id,
      actorEmail: access.user.email,
      after: Object.fromEntries(entries.map((e) => [e.kpiId, e.value])),
      metadata: { employeeName: employee.name, period: period.toISOString().slice(0, 7), week, cleared: clears.length },
    });
  });

  const raw: Record<string, number> = Object.fromEntries(entries.map((e) => [e.kpiId, e.value]));
  const total = scoreWeek(kpis, raw).total;

  revalidatePath("/performance");
  revalidatePath(`/performance/people/${employeeId}`);
  return ok({ total }, `Saved week ${week} for ${employee.name}: ${total} / ${kpis.reduce((s, k) => s + k.maxPoints, 0)}.`);
}

/**
 * Saves one person's critical KPI deductions for a month. These come off the
 * month's score (85 with 25 deducted is 60). Same rules as weekly scores:
 * only the person's scorer, only while the month is still with them. A blank
 * field clears that deduction.
 */
export async function savePenalties(
  _prev: ActionResult<{ deduction: number }> | undefined,
  formData: FormData
): Promise<ActionResult<{ deduction: number }>> {
  const access = await getPerformanceAccess();
  const employeeId = String(formData.get("employeeId") ?? "");
  const period = parseReviewPeriod(String(formData.get("period") ?? ""));
  if (!period) return fail("That month is not valid.");
  if (!canScore(access, employeeId)) throw new ForbiddenError("You do not score this person.");

  const [assignment, existingReview] = await Promise.all([
    prisma.perfAssignment.findUnique({ where: { employeeId } }),
    prisma.perfReview.findUnique({ where: { employeeId_period: { employeeId, period } }, select: { status: true } }),
  ]);
  if (!assignment) return fail("This person has no scorecard assigned yet.");
  if (existingReview && !canEditScores(existingReview.status)) {
    return fail(existingReview.status === "CONFIRMED" ? "This month is confirmed and locked." : "This month is with the reviewer.");
  }
  const version = await getVersionForPeriod(assignment.templateId, period);
  if (!version) return fail("No scorecard is in force for that month yet.");

  const maxTotal = kpiDefsOf(version).reduce((s, k) => s + k.maxPoints, 0);
  const entries: { riskId: string; points: number; remark: string | null }[] = [];
  const clears: string[] = [];
  const fieldErrors: Record<string, string[]> = {};
  for (const risk of version.risks.filter((r) => r.deductible)) {
    const raw = String(formData.get(`penalty_${risk.id}`) ?? "").trim();
    const remark = String(formData.get(`penaltyRemark_${risk.id}`) ?? "").trim().slice(0, 500) || null;
    if (raw === "" || Number(raw) === 0) {
      clears.push(risk.id);
      continue;
    }
    const points = Number(raw);
    const cap = risk.maxPenalty ?? maxTotal;
    if (!Number.isFinite(points) || points < 0 || points > cap) {
      fieldErrors[`penalty_${risk.id}`] = [`Enter 0 to ${cap}.`];
      continue;
    }
    entries.push({ riskId: risk.id, points, remark });
  }
  if (Object.keys(fieldErrors).length > 0) return fail("Some deductions are out of range.", fieldErrors);

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { name: true } });
  await prisma.$transaction(async (tx) => {
    if (clears.length > 0) await tx.perfPenalty.deleteMany({ where: { employeeId, period, riskId: { in: clears } } });
    for (const e of entries) {
      await tx.perfPenalty.upsert({
        where: { employeeId_riskId_period: { employeeId, riskId: e.riskId, period } },
        create: { employeeId, riskId: e.riskId, period, points: e.points, remark: e.remark, enteredById: access.user.id, enteredByName: access.user.name },
        update: { points: e.points, remark: e.remark, enteredById: access.user.id, enteredByName: access.user.name },
      });
    }
    await writeAuditEvent(tx, {
      entityType: "PerfPenalty",
      entityId: employeeId,
      action: "PERF_SCORE_SAVED",
      actorUserId: access.user.id,
      actorEmail: access.user.email,
      after: Object.fromEntries(entries.map((e) => [e.riskId, e.points])),
      metadata: { employeeName: employee.name, period: period.toISOString().slice(0, 7), kind: "critical-kpi-deductions", cleared: clears.length },
    });
  });

  const deduction = entries.reduce((s, e) => s + e.points, 0);
  revalidatePath("/performance");
  revalidatePath(`/performance/people/${employeeId}`);
  return ok({ deduction }, deduction > 0 ? `Saved: ${deduction} points deducted from ${employee.name}'s month.` : `No deductions for ${employee.name} this month.`);
}

// ── Setup (HR / Admin) ───────────────────────────────────────────────

export async function saveAssignment(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const { user } = await requirePermission("PERF_SETUP");
  const parsed = assignmentSchema.safeParse({
    employeeId: formData.get("employeeId"),
    templateId: formData.get("templateId"),
    scorerUserId: formData.get("scorerUserId"),
  });
  if (!parsed.success) return fail("Choose a template and a scorer.", parsed.error.flatten().fieldErrors);
  const { employeeId, templateId, scorerUserId } = parsed.data;

  const [employee, template, scorer, existing] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true, email: true, isActive: true } }),
    prisma.perfTemplate.findUnique({ where: { id: templateId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: scorerUserId }, select: { id: true, name: true, email: true, isActive: true } }),
    prisma.perfAssignment.findUnique({ where: { employeeId } }),
  ]);
  if (!employee || !employee.isActive) return fail("That employee is not available.");
  if (!template) return fail("That template no longer exists.");
  if (!scorer || !scorer.isActive) return fail("That scorer's account is not active.");
  if (scorer.email.toLowerCase() === employee.email.toLowerCase()) return fail("Nobody can score themselves.");

  await prisma.$transaction(async (tx) => {
    await tx.perfAssignment.upsert({
      where: { employeeId },
      create: { employeeId, templateId, scorerUserId },
      update: { templateId, scorerUserId },
    });
    await writeAuditEvent(tx, {
      entityType: "PerfAssignment",
      entityId: employeeId,
      action: "PERF_ASSIGNMENT_SAVED",
      actorUserId: user.id,
      actorEmail: user.email,
      before: existing ? { templateId: existing.templateId, scorerUserId: existing.scorerUserId } : undefined,
      after: { templateId, scorerUserId },
      metadata: { employeeName: employee.name, scorerName: scorer.name },
    });
  });

  revalidatePath("/performance", "layout");
  return ok(undefined, `${employee.name} is now scored by ${scorer.name}.`);
}

export async function removeAssignment(employeeId: string): Promise<ActionResult> {
  const { user } = await requirePermission("PERF_SETUP");
  const existing = await prisma.perfAssignment.findUnique({
    where: { employeeId },
    include: { employee: { select: { name: true } } },
  });
  if (!existing) return ok(undefined);
  await prisma.$transaction(async (tx) => {
    await tx.perfAssignment.delete({ where: { employeeId } });
    await writeAuditEvent(tx, {
      entityType: "PerfAssignment",
      entityId: employeeId,
      action: "PERF_ASSIGNMENT_SAVED",
      actorUserId: user.id,
      actorEmail: user.email,
      before: { templateId: existing.templateId, scorerUserId: existing.scorerUserId },
      metadata: { employeeName: existing.employee.name, removed: true },
    });
  });
  revalidatePath("/performance", "layout");
  return ok(undefined, `${existing.employee.name} no longer has a scorecard.`);
}

export async function saveTemplateDetails(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requirePermission("PERF_SETUP");
  const id = String(formData.get("id") ?? "") || null;
  const parsed = templateDetailsSchema.safeParse({
    name: formData.get("name"),
    roleDefinition: formData.get("roleDefinition") ?? undefined,
    responsibilities: formData.get("responsibilities") ?? undefined,
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  const clash = await prisma.perfTemplate.findUnique({ where: { name: parsed.data.name } });
  if (clash && clash.id !== id) return fail("A template with that name already exists.", { name: ["Already in use."] });

  const saved = await prisma.$transaction(async (tx) => {
    const t = id
      ? await tx.perfTemplate.update({ where: { id }, data: parsed.data })
      : await tx.perfTemplate.create({ data: parsed.data });
    await writeAuditEvent(tx, {
      entityType: "PerfTemplate",
      entityId: t.id,
      action: "PERF_TEMPLATE_SAVED",
      actorUserId: user.id,
      actorEmail: user.email,
      after: parsed.data,
    });
    return t;
  });
  revalidatePath("/performance", "layout");
  return ok({ id: saved.id }, id ? "Template updated." : "Template created.");
}

/**
 * Saves a scorecard version. Existing KPIs are matched by id so scores
 * already entered stay attached; a KPI that has scores can't be deleted
 * (add a new version from the month it should stop instead).
 */
export async function saveTemplateVersion(input: unknown): Promise<ActionResult<{ versionId: string }>> {
  const { user } = await requirePermission("PERF_SETUP");
  const parsed = versionSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first?.message ?? "The scorecard is not valid.");
  }
  const data = parsed.data;
  const effectiveFrom = parseMonth(data.effectiveFrom);
  if (!effectiveFrom) return fail("Pick the month this takes effect.");

  const template = await prisma.perfTemplate.findUnique({ where: { id: data.templateId } });
  if (!template) return fail("That template no longer exists.");

  const sameMonth = await prisma.perfTemplateVersion.findUnique({
    where: { templateId_effectiveFrom: { templateId: data.templateId, effectiveFrom } },
  });
  if (sameMonth && sameMonth.id !== data.versionId) {
    return fail("This template already has a version for that month. Edit that one instead.");
  }

  let existingKpiIds = new Set<string>();
  let existingKraIds = new Set<string>();
  if (data.versionId) {
    const existing = await prisma.perfTemplateVersion.findFirst({
      where: { id: data.versionId, templateId: data.templateId },
      include: { kras: { include: { kpis: { select: { id: true } } } } },
    });
    if (!existing) return fail("That version no longer exists.");
    existingKraIds = new Set(existing.kras.map((k) => k.id));
    existingKpiIds = new Set(existing.kras.flatMap((k) => k.kpis.map((p) => p.id)));
  }

  const keptKraIds = new Set(data.kras.map((k) => k.id).filter((id): id is string => !!id && existingKraIds.has(id)));
  const keptKpiIds = new Set(
    data.kras.flatMap((k) => k.kpis.map((p) => p.id)).filter((id): id is string => !!id && existingKpiIds.has(id))
  );
  const removedKpiIds = [...existingKpiIds].filter((id) => !keptKpiIds.has(id));
  if (removedKpiIds.length > 0) {
    const used = await prisma.perfScore.count({ where: { kpiId: { in: removedKpiIds } } });
    if (used > 0) {
      return fail("A KPI you removed already has scores. Keep it here and add a new version from the month it should stop.");
    }
  }

  const versionId = await prisma.$transaction(async (tx) => {
    const version = data.versionId
      ? await tx.perfTemplateVersion.update({ where: { id: data.versionId }, data: { effectiveFrom } })
      : await tx.perfTemplateVersion.create({ data: { templateId: data.templateId, effectiveFrom } });

    // Scores reference KPIs, so detach before deleting; the check above
    // guarantees nothing deleted here has scores.
    await tx.perfKpi.deleteMany({ where: { id: { in: removedKpiIds } } });

    const finalKraIds: string[] = [];
    for (const [ki, kra] of data.kras.entries()) {
      const kraId =
        kra.id && keptKraIds.has(kra.id)
          ? (await tx.perfKra.update({ where: { id: kra.id }, data: { name: kra.name, sortOrder: ki } })).id
          : (await tx.perfKra.create({ data: { versionId: version.id, name: kra.name, sortOrder: ki } })).id;
      finalKraIds.push(kraId);

      for (const [pi, kpi] of kra.kpis.entries()) {
        const fields = {
          name: kpi.name,
          description: kpi.description,
          maxPoints: kpi.maxPoints,
          mode: kpi.mode,
          target: kpi.mode === "TARGET" ? (kpi.target ?? null) : null,
          direction: kpi.mode === "TARGET" ? (kpi.direction ?? null) : null,
          sortOrder: pi,
        };
        if (kpi.id && keptKpiIds.has(kpi.id)) {
          await tx.perfKpi.update({ where: { id: kpi.id }, data: { ...fields, kraId } });
        } else {
          await tx.perfKpi.create({ data: { ...fields, kraId } });
        }
      }
    }

    // Only after every KPI has been moved to its final KRA, so dropping an
    // emptied KRA can never cascade over a KPI that was moved out of it.
    await tx.perfKra.deleteMany({ where: { versionId: version.id, id: { notIn: finalKraIds } } });

    await tx.perfRisk.deleteMany({ where: { versionId: version.id } });
    if (data.risks.length > 0) {
      await tx.perfRisk.createMany({
        data: data.risks.map((r, i) => ({
          versionId: version.id,
          category: r.category,
          name: r.name,
          description: r.description,
          alertLevel: r.alertLevel,
          sortOrder: i,
        })),
      });
    }

    await writeAuditEvent(tx, {
      entityType: "PerfTemplateVersion",
      entityId: version.id,
      action: "PERF_TEMPLATE_SAVED",
      actorUserId: user.id,
      actorEmail: user.email,
      metadata: {
        template: template.name,
        effectiveFrom: data.effectiveFrom,
        kras: data.kras.length,
        kpis: data.kras.reduce((s, k) => s + k.kpis.length, 0),
        totalPoints: data.kras.reduce((s, k) => s + k.kpis.reduce((p, x) => p + x.maxPoints, 0), 0),
      },
    });
    return version.id;
  });

  revalidatePath("/performance", "layout");
  return ok({ versionId }, "Scorecard saved.");
}
