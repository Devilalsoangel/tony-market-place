import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string | number;
  tone?: "default" | "green" | "amber" | "red" | "purple";
}

const TONE: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "text-[#18181B]",
  green: "text-[#16A34A]",
  amber: "text-[#B45309]",
  red: "text-[#EF4444]",
  purple: "text-[#6C3BFF]",
};

export function StatTile({ label, value, tone = "default" }: StatTileProps) {
  return (
    <div className="rounded-[6px] bg-white p-4">
      <p className="text-[13px] font-medium text-[#71717A]">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums tracking-[-0.02em]", TONE[tone])}>
        {value}
      </p>
    </div>
  );
}