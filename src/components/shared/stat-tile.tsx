import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatTile({
  label,
  value,
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  /** Marks the one number a view leads with. */
  emphasis?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-metadata">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", emphasis ? "text-brand" : "text-muted-foreground")} />}
      </div>
      <p className={cn("text-metric mt-1", emphasis && "text-brand")}>{value}</p>
    </Card>
  );
}
