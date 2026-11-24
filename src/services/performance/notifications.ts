import { sendReviewEmail, type SendResult } from "@/services/email/resend";

/**
 * The emails the performance workflow sends: a heads-up when something needs
 * someone, and the reminders. Plain and short on purpose — each says what
 * needs doing and links straight to where.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Base URL of this app, for links in emails. Optional: without it the email just omits the link. */
export function appUrl(path: string): string | null {
  const base = process.env.APP_URL?.replace(/\/+$/, "");
  return base ? `${base}${path}` : null;
}

export interface ComposedEmail {
  subject: string;
  text: string;
  html: string;
}

export function compose(input: { subject: string; heading: string; intro: string; bullets?: string[]; link?: { label: string; url: string } | null }): ComposedEmail {
  const bullets = input.bullets ?? [];
  const text = [
    input.heading,
    "",
    input.intro,
    ...(bullets.length ? ["", ...bullets.map((b) => `  • ${b}`)] : []),
    ...(input.link ? ["", `${input.link.label}: ${input.link.url}`] : []),
    "",
    "ONEVIEW Review",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f1ff;font-family:Arial,Helvetica,sans-serif;color:#1d1740">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
<tr><td>
<h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(input.heading)}</h2>
<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(input.intro)}</p>
${bullets.length ? `<ul style="margin:0 0 16px;padding-left:20px;line-height:1.6">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""}
${input.link ? `<p style="margin:20px 0 0"><a href="${escapeHtml(input.link.url)}" style="background:#0866ff;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:bold;display:inline-block">${escapeHtml(input.link.label)}</a></p>` : ""}
<p style="margin:24px 0 0;font-size:12px;color:#6b6685">ONEVIEW Review · Haris&amp;Co. &amp; HACA</p>
</td></tr></table></body></html>`;

  return { subject: input.subject, text, html };
}

/** Best-effort: a failed notification must never fail the action that triggered it. */
export async function notify(to: string, email: ComposedEmail): Promise<SendResult> {
  try {
    return await sendReviewEmail({ to, ...email });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown send error" };
  }
}

export const monthLabel = (period: Date) =>
  period.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function submittedEmail(args: { reviewerName: string; scorerName: string; employeeName: string; period: Date; employeeId: string }) {
  return compose({
    subject: `Review needed: ${args.employeeName}'s ${monthLabel(args.period)} scores`,
    heading: "A submission is waiting for your review",
    intro: `${args.scorerName} has submitted ${args.employeeName}'s scores for ${monthLabel(args.period)}. Confirm them to send them on to HR, or send them back with a note.`,
    link: (() => {
      const url = appUrl(`/performance/people/${args.employeeId}?period=${args.period.toISOString().slice(0, 7)}`);
      return url ? { label: "Review now", url } : null;
    })(),
  });
}

export function revisionEmail(args: { scorerName: string; reviewerName: string; employeeName: string; period: Date; note: string; employeeId: string }) {
  return compose({
    subject: `Changes requested: ${args.employeeName}'s ${monthLabel(args.period)} scores`,
    heading: "Your submission was sent back",
    intro: `${args.reviewerName} asked for changes to ${args.employeeName}'s scores for ${monthLabel(args.period)}.`,
    bullets: [`Their note: ${args.note}`],
    link: (() => {
      const url = appUrl(`/performance/score?employee=${args.employeeId}&period=${args.period.toISOString().slice(0, 7)}`);
      return url ? { label: "Make the changes", url } : null;
    })(),
  });
}

export function scorerReminderEmail(args: { period: Date; people: { name: string; detail: string }[] }) {
  return compose({
    subject: `Reminder: ${args.people.length} ${args.people.length === 1 ? "person" : "people"} to submit for ${monthLabel(args.period)}`,
    heading: `Scores to submit for ${monthLabel(args.period)}`,
    intro: "These people still need their month submitted for review:",
    bullets: args.people.map((p) => `${p.name}: ${p.detail}`),
    link: (() => {
      const url = appUrl("/performance/score");
      return url ? { label: "Open Score Team", url } : null;
    })(),
  });
}

export function reviewerReminderEmail(args: { period: Date; names: string[] }) {
  return compose({
    subject: `Reminder: ${args.names.length} ${args.names.length === 1 ? "submission" : "submissions"} waiting for your review`,
    heading: `Waiting for your review: ${monthLabel(args.period)}`,
    intro: "These submissions are waiting for you to confirm them or send them back:",
    bullets: args.names,
    link: (() => {
      const url = appUrl("/performance/reviews");
      return url ? { label: "Open reviews", url } : null;
    })(),
  });
}
