import type { TemplateType } from "@prisma/client";
import { EMAIL_TEMPLATES } from "./templates";

export interface EmailVariables {
  employee_name: string;
  month_name: string;
  year: string;
  feedback: string;
}

/** HR's edited wording; paragraphs in `body` are separated by a blank line. */
export interface TemplateOverride {
  subject: string;
  body: string;
}

export type TemplateOverrides = Partial<Record<TemplateType, TemplateOverride>>;

/** The built-in wording in the same editable shape. */
export function defaultTemplate(type: TemplateType): TemplateOverride {
  const def = EMAIL_TEMPLATES[type];
  return { subject: def.subjectTemplate, body: def.paragraphs.join("\n\n") };
}

export const paragraphsOf = (body: string) =>
  body
    .replace(/\r\n/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function substitute(template: string, vars: EmailVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: keyof EmailVariables) => vars[key] ?? "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders the final employee email (§21 — "Employee + Template A/B/C +
 * Department Head Feedback -> Final Email"). Plain-text vars go into the
 * text body verbatim; HTML vars are escaped so a feedback string containing
 * "<" or "&" can't break the markup.
 */
export function renderEmail(type: TemplateType, vars: EmailVariables, override?: TemplateOverride): RenderedEmail {
  const def = override ? { subjectTemplate: override.subject, paragraphs: paragraphsOf(override.body) } : EMAIL_TEMPLATES[type];
  const subject = substitute(def.subjectTemplate, vars);
  const text = def.paragraphs.map((p) => substitute(p, vars)).join("\n\n");

  const escapedVars: EmailVariables = {
    employee_name: escapeHtml(vars.employee_name),
    month_name: escapeHtml(vars.month_name),
    year: escapeHtml(vars.year),
    feedback: escapeHtml(vars.feedback),
  };
  const html = def.paragraphs
    .map((p) => `<p>${substitute(p, escapedVars).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");

  return { subject, text, html };
}
