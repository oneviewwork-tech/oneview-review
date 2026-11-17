"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import type { ReviewPermission } from "@prisma/client";
import { useToast } from "@/components/ui/toast";
import { deleteRole, duplicateRole, setRolePermission } from "@/actions/roles.actions";
import { cn } from "@/lib/utils";

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { push } = useToast();
  const run = (fn: () => Promise<{ success: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      push(r.success ? "success" : "error", r.message ?? (r.success ? "Done." : "Something went wrong."));
      if (r.success) router.refresh();
    });
  return { pending, run };
}

/** Duplicate / delete buttons on a role row. */
export function RoleRowActions({ roleId, name, canDuplicate, canDelete }: { roleId: string; name: string; canDuplicate: boolean; canDelete: boolean }) {
  const { pending, run } = useRun();
  return (
    <>
      {canDuplicate && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => duplicateRole(roleId))}
          aria-label={`Duplicate ${name}`}
          title="Duplicate"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground"
        >
          <Copy className="size-3.5" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteRole(roleId))}
          aria-label={`Delete ${name}`}
          title="Delete"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-destructive-subtle hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </>
  );
}

/** One cell of the permission matrix: a checkbox that saves straight away. */
export function PermissionToggle({
  roleId,
  permission,
  granted,
  disabled,
  label,
}: {
  roleId: string;
  permission: ReviewPermission;
  granted: boolean;
  disabled: boolean;
  label: string;
}) {
  const { pending, run } = useRun();
  return (
    <input
      type="checkbox"
      aria-label={label}
      title={disabled ? "You can't change this" : label}
      className={cn("size-4 accent-[var(--brand)]", (disabled || pending) && "cursor-not-allowed opacity-50")}
      checked={granted}
      disabled={disabled || pending}
      onChange={(e) => run(() => setRolePermission(roleId, permission, e.target.checked))}
    />
  );
}
