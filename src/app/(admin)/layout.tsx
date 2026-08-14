import { requireAdmin } from "@/lib/rbac";
import { AppHeader } from "@/components/shared/app-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        navItems={[
          { href: "/admin/departments", label: "Departments" },
          { href: "/admin/employees", label: "Employees" },
          { href: "/admin/users", label: "Users" },
        ]}
        userName={admin.name}
        userMeta="Admin"
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
