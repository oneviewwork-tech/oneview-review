import { requireDepartmentHead } from "@/lib/rbac";
import { AppHeader } from "@/components/shared/app-header";
import { prisma } from "@/lib/prisma";

export default async function DepartmentHeadLayout({ children }: { children: React.ReactNode }) {
  const { user, departmentId } = await requireDepartmentHead();
  const department = await prisma.department.findUniqueOrThrow({ where: { id: departmentId } });

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        navItems={[
          { href: "/review", label: "Review" },
          { href: "/my-submissions", label: "My Submissions" },
        ]}
        userName={user.name}
        userMeta={department.name}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
