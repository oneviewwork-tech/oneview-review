import { describe, it, expect } from "vitest";
import { signSsoTicket, verifySsoTicket, SSO_TTL_MS } from "@/lib/sso-token";

const SECRET = "x".repeat(40);
const user = { id: "u1", email: "Neha@HarisAnd.co" };

describe("People -> Review sign-in ticket", () => {
  it("round-trips for the right secret", () => {
    const r = verifySsoTicket(signSsoTicket(user, SECRET), SECRET);
    expect(r.ok && r.ticket.email).toBe("neha@harisand.co");
  });

  it("rejects another secret, a tampered body and junk", () => {
    const t = signSsoTicket(user, SECRET);
    expect(verifySsoTicket(t, "y".repeat(40))).toEqual({ ok: false, reason: "invalid" });
    const [, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "admin", email: "a@b.c", exp: Date.now() + 1000, jti: "j" })).toString("base64url");
    expect(verifySsoTicket(`${forged}.${sig}`, SECRET).ok).toBe(false);
    expect(verifySsoTicket("nope", SECRET).ok).toBe(false);
  });

  it("expires after the TTL", () => {
    const now = Date.now();
    const t = signSsoTicket(user, SECRET, now);
    expect(verifySsoTicket(t, SECRET, now + SSO_TTL_MS + 1)).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses a weak secret", () => {
    expect(() => signSsoTicket(user, "short")).toThrow();
    expect(verifySsoTicket(signSsoTicket(user, SECRET), "short").ok).toBe(false);
  });
});
