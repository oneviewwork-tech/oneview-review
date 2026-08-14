import { requireDepartmentHead } from "@/lib/rbac";
import { AppHeader } from "@/components/shared/app-header";

export default async function DepartmentHeadLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireDepartmentHead();

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        navItems={[
          { href: "/review", label: "Review" },
          { href: "/my-submissions", label: "My Submissions" },
        ]}
        userName={user.name}
        userMeta={user.department?.name ?? ""}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
