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

/** The photo's bytes: the thumbnail if there is one, else the original. */
export async function fetchPeoplePhoto(key: string, size: "thumb" | "full"): Promise<{ body: ArrayBuffer; type: string } | null> {
  const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const get = async (objectKey: string) => {
    const res = await fetch(`${base}/storage/v1/object/${BUCKET()}/${objectKey.split("/").map(encodeURIComponent).join("/")}`, {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return { body: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "image/webp" };
  };
  return (size === "thumb" ? await get(`${key}.thumb.webp`) : null) ?? (await get(key));
}
