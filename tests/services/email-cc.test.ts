import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Guards the CC rules on the review email. These matter because the CC is
 * a real person's inbox: the submitter must be copied, and the recipient
 * must never be copied on their own review.
 */
const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const BASE = { subject: "s", text: "t", html: "<p>t</p>" };

describe("sendReviewEmail cc handling", () => {
  beforeEach(() => {
    vi.resetModules();
    send.mockReset();
    send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "ONEVIEW <no-reply@example.com>";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it("copies the submitter in", async () => {
    const { sendReviewEmail } = await import("@/services/email/resend");
    await sendReviewEmail({ to: "employee@x.co", cc: ["head@x.co"], ...BASE });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "employee@x.co", cc: ["head@x.co"] }));
  });

  it("never copies the recipient on their own review", async () => {
    const { sendReviewEmail } = await import("@/services/email/resend");
    // A department head reviewing themselves: to and cc are the same person.
    await sendReviewEmail({ to: "head@x.co", cc: ["Head@X.co"], ...BASE });
    expect(send).toHaveBeenCalledWith(expect.not.objectContaining({ cc: expect.anything() }));
  });

  it("drops duplicates and blanks rather than passing them to the provider", async () => {
    const { sendReviewEmail } = await import("@/services/email/resend");
    await sendReviewEmail({ to: "e@x.co", cc: ["head@x.co", "HEAD@x.co", "  ", ""], ...BASE });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ cc: ["head@x.co"] }));
  });

  it("omits cc entirely when there is no submitter address", async () => {
    const { sendReviewEmail } = await import("@/services/email/resend");
    await sendReviewEmail({ to: "e@x.co", cc: [], ...BASE });
    expect(send).toHaveBeenCalledWith(expect.not.objectContaining({ cc: expect.anything() }));
  });
});
