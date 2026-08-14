"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

export function DepartmentFilter({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("department") ?? "all";

  return (
    <Select
      className="w-56"
      value={current}
      onChange={(e) => {
        const value = e.target.value;
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all") params.delete("department");
        else params.set("department", value);
        router.push(`/submissions?${params.toString()}`);
      }}
    >
      <option value="all">All Departments</option>
      {departments.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </Select>
  );
}
