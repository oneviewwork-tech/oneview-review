"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";

/** Marks all of the signed-in user's notifications read (opening the bell). */
export async function markMyNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
}
