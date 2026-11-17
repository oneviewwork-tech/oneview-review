import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * ONEVIEW People -> Review sign-in handoff.
 *
 * People signs a short-lived ticket for the person already signed in there;
 * Review checks it and signs them in, so "Performance" in People opens Review
 * without a second login. Both apps hold the same REVIEW_SSO_SECRET.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
 * Keep this file byte-identical in both apps.
 */
export interface SsoTicket {
  /** People's User id. */
  sub: string;
  email: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
  /** One-time id: Review refuses a ticket it has seen before. */
  jti: string;
}

export const SSO_TTL_MS = 60_000;

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest();

export function signSsoTicket(user: { id: string; email: string }, secret: string, now = Date.now()): string {
  if (!secret || secret.length < 32) throw new Error("REVIEW_SSO_SECRET must be at least 32 characters.");
  const payload: SsoTicket = { sub: user.id, email: user.email.toLowerCase(), exp: now + SSO_TTL_MS, jti: randomUUID() };
  const body = b64(JSON.stringify(payload));
  return `${body}.${b64(mac(body, secret))}`;
}

export type SsoCheck = { ok: true; ticket: SsoTicket } | { ok: false; reason: "invalid" | "expired" };

export function verifySsoTicket(token: string, secret: string, now = Date.now()): SsoCheck {
  if (!secret || secret.length < 32) return { ok: false, reason: "invalid" };
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return { ok: false, reason: "invalid" };
  const given = Buffer.from(sig, "base64url");
  const expected = mac(body, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };
  let t: SsoTicket;
  try {
    t = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof t?.sub !== "string" || typeof t.email !== "string" || typeof t.exp !== "number" || typeof t.jti !== "string") {
    return { ok: false, reason: "invalid" };
  }
  // Never more than one TTL into the future either: a ticket can't be minted to last.
  if (t.exp < now || t.exp > now + SSO_TTL_MS + 5_000) return { ok: false, reason: "expired" };
  return { ok: true, ticket: t };
}
