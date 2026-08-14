import { Card } from "@/components/ui/card";

export function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-metadata">{label}</p>
      <p className="text-metric mt-1">{value}</p>
    </Card>
  );
}
