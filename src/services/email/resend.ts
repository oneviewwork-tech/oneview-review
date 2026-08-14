import { Resend } from "resend";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured: set RESEND_API_KEY and EMAIL_FROM.");
    this.name = "EmailNotConfiguredError";
  }
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

let client: Resend | null = null;
function getClient(): Resend {
  if (!process.env.RESEND_API_KEY) throw new EmailNotConfiguredError();
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends one employee email via Resend (§22). Never throws for a delivery
 * failure — returns {ok:false, error} so the caller can record the
 * submission as still-CONFIRMED-not-SENT rather than silently losing the
 * failure (§22: "If sending fails, the submission should not be
 * incorrectly marked as SENT").
 */
export async function sendReviewEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;
  if (!from) return { ok: false, error: "EMAIL_FROM is not configured." };

  // Dev convenience only — never in production, where a missing key must
  // surface as a real failure rather than a silent no-op.
  if (!isEmailConfigured() && process.env.NODE_ENV !== "production") {
    console.warn(`[email:dev] to=${input.to} subject="${input.subject}"\n${input.text}`);
    return { ok: true, messageId: `dev-${Date.now()}` };
  }

  try {
    const resend = getClient();
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, messageId: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown send error" };
  }
}
