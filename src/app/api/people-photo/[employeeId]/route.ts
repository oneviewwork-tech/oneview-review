import { requireUser } from "@/lib/rbac";
import { fetchPeoplePhoto, peoplePhotoKey, photosConfigured } from "@/services/people/photo";

/**
 * A Review employee's profile photo, from ONEVIEW People's storage. Any
 * signed-in user can view photos, as in People; the storage object itself is
 * never publicly addressable. `?size=full` returns the original.
 */
export async function GET(req: Request, ctx: { params: Promise<{ employeeId: string }> }) {
  await requireUser();
  if (!photosConfigured()) return new Response("Photos are not configured", { status: 404 });

  const { employeeId } = await ctx.params;
  const key = await peoplePhotoKey(employeeId);
  if (!key) return new Response("No photo", { status: 404 });

  const size = new URL(req.url).searchParams.get("size") === "full" ? "full" : "thumb";
  const photo = await fetchPeoplePhoto(key, size);
  if (!photo) return new Response("No photo", { status: 404 });

  return new Response(photo.body, {
    headers: {
      "Content-Type": photo.type,
      // The URL carries the storage key (?v=), so it can be cached hard: a new upload gets a new URL.
      "Cache-Control": "private, max-age=604800, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
