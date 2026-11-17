"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Layers } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";

export interface ScopeOrganization {
  id: string;
  name: string;
  code?: string;
  departments: { id: string; name: string }[];
}

/**
 * The page's department filter. The organization is chosen once, in the
 * sidebar switcher, and holds across pages; `organizations` arrives already
 * narrowed to it, so the departments listed are that organization's.
 */
export function ScopeFilter({
  organizations,
  showDepartment = true,
}: {
  organizations: ScopeOrganization[];
  showDepartment?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const department = searchParams.get("department") ?? "all";
  // With several organizations in view, name each department's own.
  const several = organizations.length > 1;
  const departmentOptions = organizations.flatMap((o) => o.departments.map((d) => ({ ...d, name: several ? `${d.name} · ${o.name}` : d.name })));

  function push(next: { department?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      {showDepartment && (
        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Dropdown
            className="w-full sm:w-52"
            value={department}
            onChange={(value) => push({ department: value })}
            placeholder="All Departments"
            options={[
              { value: "all", label: "All Departments" },
              ...departmentOptions.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        </div>
      )}
    </div>
  );
}
