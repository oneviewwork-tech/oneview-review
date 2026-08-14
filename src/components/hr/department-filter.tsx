"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Dropdown } from "@/components/ui/dropdown";

export function DepartmentFilter({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("department") ?? "all";

  return (
    <Dropdown
      className="w-56"
      value={current}
      onChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all") params.delete("department");
        else params.set("department", value);
        router.push(`/submissions?${params.toString()}`);
      }}
      options={[{ value: "all", label: "All Departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
    />
  );
}
