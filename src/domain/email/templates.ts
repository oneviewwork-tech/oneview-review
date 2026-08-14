import type { TemplateType } from "@prisma/client";

/**
 * The three predefined email templates (§4 — A/B/C are EMAIL TEMPLATE
 * TYPES, not performance grades). Verbatim wording as provided by HR.
 * Centralized here — nowhere else in the app should hardcode template
 * copy (§21: "Do not duplicate email-generation logic").
 *
 * Only {{feedback}} varies per submission; {{employee_name}}, {{month_name}}
 * and {{year}} are filled in automatically. Everything else is fixed.
 */
export interface EmailTemplateDef {
  label: string;
  subjectTemplate: string;
  /** Paragraph blocks, joined with a blank line. {{feedback}} is its own block. */
  paragraphs: string[];
}

export const EMAIL_TEMPLATES: Record<TemplateType, EmailTemplateDef> = {
  A: {
    label: "Template A",
    subjectTemplate: "Appreciation for Your Strong Performance & Contribution – {{month_name}} {{year}}",
    paragraphs: [
      "Hi {{employee_name}},",
      "As part of the monthly performance review for {{month_name}}, we would like to appreciate your valuable contribution and strong performance throughout the month.",
      "Your review reflected a high level of consistency, ownership, accountability, and execution quality across responsibilities. The contribution and commitment demonstrated during this review period created a positive impact within the team and department.",
      "{{feedback}}",
      "Overall, your performance during this review cycle reflected strong contribution and positive impact towards team and department goals.",
      "Your efforts and contribution are genuinely appreciated, and we look forward to your continued consistency, ownership, and strong performance moving forward.",
      "If you require any support or guidance at any stage, please feel free to reach out to your reporting manager or department head.",
      "Regards,\nHR Team",
    ],
  },
  B: {
    label: "Template B",
    subjectTemplate: "Performance Feedback & Development Focus Areas – {{month_name}} {{year}}",
    paragraphs: [
      "Hi {{employee_name}},",
      "As part of the monthly performance review for {{month_name}}, we would like to acknowledge your contribution and consistent support during the review period.",
      "Your performance reflected stable execution across responsibilities and met expectations in several areas. At the same time, there are opportunities to improve consistency, ownership, initiative, and overall execution impact to achieve stronger performance levels moving forward.",
      "{{feedback}}",
      "The review indicates good potential for growth, and focused improvement in these areas will help strengthen your overall performance in upcoming review cycles.",
      "Your reporting manager will further align with you on the focus areas and expectations for the upcoming month.",
      "Regards,\nHR Team",
    ],
  },
  C: {
    label: "Template C",
    subjectTemplate: "Performance Improvement Feedback & Action Plan – {{month_name}} {{year}}",
    paragraphs: [
      "Hi {{employee_name}},",
      "As part of the monthly performance review for {{month_name}}, we would like to highlight that your current performance level is below the expected standards in several key responsibility areas.",
      "The review identified concerns related to consistency, ownership, execution quality, accountability, and overall responsibility management. Immediate improvement is expected in these areas moving forward.",
      "{{feedback}}",
      "Your reporting manager will further align with you on the required improvement areas and expected action plan for the upcoming review cycle.",
      "We encourage you to take this feedback seriously and focus on measurable improvement moving forward.",
      "Regards,\nHR Team",
    ],
  },
};

export const TEMPLATE_TYPES: TemplateType[] = ["A", "B", "C"];
