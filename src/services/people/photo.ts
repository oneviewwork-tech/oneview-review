import { prisma } from "@/lib/prisma";

/**
 * Profile photos live in ONEVIEW People: `Employee.photoStorageKey` points
 * at a private Supabase Storage object, with a ready-made thumbnail beside it
 * (`<key>.thumb.webp`). Review reads them with the same service key People
 * uses and serves them through its own signed-in route — the bucket is never
 * public.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_STORAGE_BUCKET
 * if People uses a non-default bucket). Without them there are simply no
 * photos and initials are shown instead.
 */
const BUCKET = () => process.env.SUPABASE_STORAGE_BUCKET || "employee-documents";

export const photosConfigured = () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/** People's storage key for a Review employee's photo, or null. Read-only. */
export async function peoplePhotoKey(reviewEmployeeId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ key: string | null }[]>`
    SELECT p."photoStorageKey" AS key
    FROM "review"."Employee" e
    JOIN "public"."Employee" p ON p."id" = e."peopleEmployeeId"
    WHERE e."id" = ${reviewEmployeeId}
    LIMIT 1
  `;
  return rows[0]?.key ?? null;
}

/** URL of the photo route for an employee, or undefined when there is no photo to show. */
export async function photoUrlFor(reviewEmployeeId: string): Promise<string | undefined> {
  if (!photosConfigured()) return undefined;
  const key = await peoplePhotoKey(reviewEmployeeId).catch(() => null);
  // The key is in the URL so a new upload (new key) is never served stale.
  return key ? `/api/people-photo/${reviewEmployeeId}?v=${encodeURIComponent(key)}` : undefined;
}

/**
 * Supabase's new secret keys (`sb_secret_…`) go in the `apikey` header and are
 * not JWTs, so they must not be sent as a Bearer token; legacy service_role
 * keys (JWTs, `eyJ…`) work in both.
 */
const storageHeaders = (key: string): Record<string, string> =>
  key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };

/**
 * Storage may label photos `text/plain`, and our route sends nosniff, so the
 * browser would refuse to show them: name the type from the file's own bytes.
 */
export function imageTypeOf(bytes: ArrayBuffer, given: string | null): string {
  if (given?.startsWith("image/")) return given;
  const b = new Uint8Array(bytes.slice(0, 12));
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 3) === "GIF") return "image/gif";
  return "application/octet-stream";
}

/** The photo's bytes: the thumbnail if there is one, else the original. */
export async function fetchPeoplePhoto(key: string, size: "thumb" | "full"): Promise<{ body: ArrayBuffer; type: string } | null> {
  const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const get = async (objectKey: string) => {
    const res = await fetch(`${base}/storage/v1/object/${BUCKET()}/${objectKey.split("/").map(encodeURIComponent).join("/")}`, {
      headers: storageHeaders(process.env.SUPABASE_SERVICE_ROLE_KEY!),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.arrayBuffer();
    return { body, type: imageTypeOf(body, res.headers.get("content-type")) };
  };
  return (size === "thumb" ? await get(`${key}.thumb.webp`) : null) ?? (await get(key));
}
