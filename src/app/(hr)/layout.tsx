import { requireHr } from "@/lib/rbac";
import { AppHeader } from "@/components/shared/app-header";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const user = await requireHr();

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        navItems={[
          { href: "/overview", label: "Overview" },
          { href: "/submissions", label: "Submissions" },
          { href: "/email-history", label: "Email History" },
        ]}
        userName={user.name}
        userMeta="HR"
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
