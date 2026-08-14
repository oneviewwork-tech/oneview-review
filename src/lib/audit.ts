import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface WriteAuditEventInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorUserId: string | null;
  actorEmail: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

/**
 * Appends one audit row, always inside the same transaction as the
 * mutation it describes. Append-only by construction — no update/delete
 * path exists anywhere for AuditEvent.
 */
export async function writeAuditEvent(tx: Tx, input: WriteAuditEventInput) {
  await tx.auditEvent.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
