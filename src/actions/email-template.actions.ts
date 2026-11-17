"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { defaultTemplate, paragraphsOf } from "@/domain/email/render";

const TYPES = ["A", "B", "C"] as const;
const KNOWN = new Set(["employee_name", "month_name", "year", "feedback"]);

const schema = z.object({
  type: z.enum(TYPES),
  subject: z.string().trim().min(3, "Add a subject.").max(300),
  body: z.string().trim().min(20, "The email needs some text.").max(20000),
});

/** Placeholders that aren't one of the four the system fills in (typos like {{feedbak}}). */
const unknownPlaceholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((k) => !KNOWN.has(k));

/** HR edits the wording of a feedback email. Takes effect for every email sent after saving. */
export async function saveEmailTemplate(raw: unknown): Promise<ActionResult> {
  const profile = await requirePermission("FEEDBACK_SEND");
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the template.");
  const { type, subject, body } = parsed.data;

  if (!paragraphsOf(body).some((p) => p.includes("{{feedback}}"))) {
    return fail("Keep {{feedback}} in the body: it is where each person's feedback goes.");
  }
  const unknown = [...new Set([...unknownPlaceholders(subject), ...unknownPlaceholders(body)])];
  if (unknown.length) return fail(`Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `{{${u}}}`).join(", ")}.`);

  const before = await prisma.emailTemplate.findUnique({ where: { type } });
  await prisma.emailTemplate.upsert({
    where: { type },
    create: { type, subject, body, updatedById: profile.user.id, updatedByName: profile.user.name },
    update: { subject, body, updatedById: profile.user.id, updatedByName: profile.user.name },
  });
  await writeAuditEvent(prisma, {
    entityType: "EmailTemplate",
    entityId: type,
    action: "EMAIL_TEMPLATE_SAVED",
    actorUserId: profile.user.id,
    actorEmail: profile.user.email,
    before: before ? { subject: before.subject, body: before.body } : defaultTemplate(type),
    after: { subject, body },
  });
  revalidatePath("/admin/templates");
  return ok(undefined, `Template ${type} saved.`);
}

/** Back to the built-in wording. */
export async function resetEmailTemplate(type: string): Promise<ActionResult> {
  const profile = await requirePermission("FEEDBACK_SEND");
  if (!TYPES.includes(type as (typeof TYPES)[number])) return fail("Unknown template.");
  const t = type as (typeof TYPES)[number];
  const before = await prisma.emailTemplate.findUnique({ where: { type: t } });
  if (!before) return ok(undefined, "Already the default wording.");
  await prisma.emailTemplate.delete({ where: { type: t } });
  await writeAuditEvent(prisma, {
    entityType: "EmailTemplate",
    entityId: t,
    action: "EMAIL_TEMPLATE_SAVED",
    actorUserId: profile.user.id,
    actorEmail: profile.user.email,
    before: { subject: before.subject, body: before.body },
    after: defaultTemplate(t),
    metadata: { reset: true },
  });
  revalidatePath("/admin/templates");
  return ok(undefined, `Template ${t} is back to the default wording.`);
}
