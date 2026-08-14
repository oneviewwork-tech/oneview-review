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
  /** Highlights the tile with the brand gradient — use for the one number that matters most. */
  emphasis?: boolean;
}) {
  return (
    <Card interactive className={cn("p-4", emphasis && "border-transparent bg-gradient-brand-soft")}>
      <div className="flex items-center justify-between">
        <p className="text-metadata">{label}</p>
        {Icon && <Icon className={cn("h-3.5 w-3.5", emphasis ? "text-brand" : "text-muted-foreground")} />}
      </div>
      <p className={cn("text-metric mt-1", emphasis && "gradient-text")}>{value}</p>
    </Card>
  );
}
