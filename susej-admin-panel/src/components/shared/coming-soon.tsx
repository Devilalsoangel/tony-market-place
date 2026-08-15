import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export interface ComingSoonStat {
  label: string;
  value: string;
  tone?: "default" | "green" | "amber" | "red" | "purple";
}

export interface ComingSoonRow {
  name: string;
  status: string;
  statusTone?: "default" | "green" | "amber" | "red" | "purple";
  detail: string;
}

interface ComingSoonProps {
  title: string;
  description: string;
  stats: ComingSoonStat[];
  tableTitle: string;
  rows: ComingSoonRow[];
}

const TONE_TEXT: Record<NonNullable<ComingSoonStat["tone"]>, string> = {
  default: "text-[#18181B]",
  green: "text-[#15803D]",
  amber: "text-[#B45309]",
  red: "text-[#B91C1C]",
  purple: "text-[#6C3BFF]",
};

const STATUS_PILL: Record<NonNullable<ComingSoonRow["statusTone"]>, string> = {
  default: "bg-gray-100 text-gray-600",
  green: "bg-[#16A34A]/10 text-[#15803D]",
  amber: "bg-[#F59E0B]/10 text-[#B45309]",
  red: "bg-[#EF4444]/10 text-[#B91C1C]",
  purple: "bg-[#6C3BFF]/10 text-[#6C3BFF]",
};

export function ComingSoon({ title, description, stats, tableTitle, rows }: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#18181B]">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <span className="rounded-[8px] border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs font-medium text-[#71717A]">
          In development
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[6px] bg-white p-4">
            <p className="text-[13px] font-medium text-[#71717A]">{stat.label}</p>
            <p className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-[-0.02em] ${TONE_TEXT[stat.tone ?? "default"]}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tableTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                  <th className="px-4 py-2.5 text-[13px] font-medium text-[#71717A]">Name</th>
                  <th className="px-4 py-2.5 text-[13px] font-medium text-[#71717A]">Status</th>
                  <th className="px-4 py-2.5 text-[13px] font-medium text-[#71717A]">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-[#E4E4E7]/60 transition-colors last:border-0 hover:bg-gray-50/70"
                  >
                    <td className="px-4 py-3 font-medium text-[#18181B]">{row.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[row.statusTone ?? "default"]}`}
                      >
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
