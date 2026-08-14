"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { signOut } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action-result";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function changePassword(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return fail("Your current password is incorrect.");

  if (await bcrypt.compare(parsed.data.newPassword, user.passwordHash)) {
    return fail("Choose a password different from your current one.");
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: user.id,
      action: "USER_UPDATED",
      actorUserId: user.id,
      actorEmail: user.email,
      metadata: { passwordChanged: true },
    });
  });

  // Sign out rather than returning to the app: the JWT still carries the
  // old mustChangePassword flag (JWT sessions can't be mutated
  // server-side), so keeping it would bounce the user straight back here.
  // Re-authenticating with the new password is also the safer default.
  // signOut throws a redirect — nothing after this line runs.
  await signOut({ redirectTo: "/login?passwordChanged=1" });
  return fail("Unreachable.");
}
