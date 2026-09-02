"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";

/**
 * Which review month HR is looking at.
 *
 * Necessary the moment submitting became month-aware: feedback for a month
 * is usually written in the first days of the next one, so without this the
 * dashboard would open on a fresh month and report zero while the cycle
 * everyone is actually working sat one month back, invisible.
 */
export function PeriodFilter({ periods }: { periods: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("period") ?? periods[0]?.value ?? "";

  return (
    <div className="flex items-center gap-1.5">
      <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
      <Dropdown
        className="w-44"
        value={current}
        onChange={(value) => {
          const params = new URLSearchParams(searchParams.toString());
          if (value === periods[0]?.value) params.delete("period");
          else params.set("period", value);
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }}
        options={periods}
      />
    </div>
  );
}
