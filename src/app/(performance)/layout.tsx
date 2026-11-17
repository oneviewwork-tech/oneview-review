import { prisma } from "@/lib/prisma";
import { requireSession, requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/shared/app-shell";
import { ROLE_LABEL } from "@/lib/roles";

// Performance is open to every signed-in role; what each person sees is
// scoped on the server by the scoring tree, not by this layout.
export default async function PerformanceLayout({ children }: { children: React.ReactNode }) {
  // Whether this person scores anyone decides how big their menu is. It is
  // asked at the same time as the account lookup, using the id already in the
  // session, so it adds no waiting.
  const session = await requireSession();
  const [user, scores] = await Promise.all([
    requireUser(),
    prisma.perfAssignment.findFirst({ where: { scorerUserId: session.user.id }, select: { id: true } }),
  ]);
  // A plain employee who scores nobody: just their own scorecard.
  const employeeOnly = user.role === "EMPLOYEE" && !scores;

  return (
    <AppShell
      userId={user.id}
      departmentId={user.departmentId}
      role={user.role}
      userName={user.name}
      userMeta={user.role === "EMPLOYEE" && scores ? "Reporting Manager" : ROLE_LABEL[user.role]}
      employeeOnly={employeeOnly}
    >
      {children}
    </AppShell>
  );
}
