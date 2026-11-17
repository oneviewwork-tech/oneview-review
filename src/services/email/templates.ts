import "server-only";
import { prisma } from "@/lib/prisma";
import type { TemplateOverrides } from "@/domain/email/render";

/** HR's edited wording for each template that has been changed; the rest use the built-in copy. */
export async function getTemplateOverrides(): Promise<TemplateOverrides> {
  const rows = await prisma.emailTemplate.findMany({ select: { type: true, subject: true, body: true } });
  return Object.fromEntries(rows.map((r) => [r.type, { subject: r.subject, body: r.body }]));
}
