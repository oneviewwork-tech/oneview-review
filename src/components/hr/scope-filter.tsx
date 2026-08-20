"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Building2, Layers } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";

export interface ScopeOrganization {
  id: string;
  name: string;
  departments: { id: string; name: string }[];
}

/**
 * Organization first, then department — the order HR asked for, and the
 * order the data nests in. Changing organization clears the department,
 * since a department only ever belongs to one organization.
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

  const org = searchParams.get("org") ?? "all";
  const department = searchParams.get("department") ?? "all";

  const departmentOptions =
    org === "all"
      ? organizations.flatMap((o) => o.departments)
      : (organizations.find((o) => o.id === org)?.departments ?? []);

  function push(next: { org?: string; department?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Dropdown
          className="w-52"
          value={org}
          // Department is dropped rather than kept: it would otherwise point
          // into an organization that is no longer selected.
          onChange={(value) => push({ org: value, department: "all" })}
          options={[
            { value: "all", label: "All Organizations" },
            ...organizations.map((o) => ({ value: o.id, label: o.name })),
          ]}
        />
      </div>

      {showDepartment && (
        <div className="flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Dropdown
            className="w-52"
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
