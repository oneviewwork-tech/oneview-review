import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { TemplateEditor, type TemplateState } from "@/components/admin/templates/template-editor";
import { EMAIL_TEMPLATES } from "@/domain/email/templates";
import { defaultTemplate } from "@/domain/email/render";

const TYPES = ["A", "B", "C"] as const;
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function EmailTemplatesPage() {
  // Whoever sends the feedback emails owns their wording.
  await requirePermission("FEEDBACK_SEND");
  const rows = await prisma.emailTemplate.findMany();

  const templates: TemplateState[] = TYPES.map((type) => {
    const row = rows.find((r) => r.type === type);
    const builtIn = defaultTemplate(type);
    return {
      type,
      label: EMAIL_TEMPLATES[type].label,
      builtIn,
      current: row ? { subject: row.subject, body: row.body } : builtIn,
      customized: !!row,
      editedNote: row ? `Edited${row.updatedByName ? ` by ${row.updatedByName}` : ""}, ${dateFmt.format(row.updatedAt)}` : null,
    };
  });

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Email Templates"
        description="The wording of the A, B and C feedback emails. Changes apply to every email sent after you save; emails already sent keep the wording they went out with."
      />
      <TemplateEditor templates={templates} />
    </div>
  );
}
