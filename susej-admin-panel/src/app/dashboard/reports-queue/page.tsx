"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDbResource } from "@/hooks/use-db-resource";
import { Package, MessageCircle, UsersRound, MessageSquare, Star, ChevronRight } from "lucide-react";
import type { ReportedProductRow, ReportedMessageRow, ReportedCommentRow } from "@/types/admin-rows";
import type { Community, Review } from "@/types";

const TONES: Record<string, string> = {
  red: "bg-[#EF4444]/10 text-[#EF4444]",
  amber: "bg-[#F59E0B]/10 text-[#F59E0B]",
  violet: "bg-[#6C3BFF]/10 text-[#6C3BFF]",
};

export default function ReportsQueuePage() {
  const { data: products } = useDbResource<ReportedProductRow>("reported-products");
  const { data: messages } = useDbResource<ReportedMessageRow>("reported-messages");
  const { data: communities } = useDbResource<Community>("communities");
  const { data: comments } = useDbResource<ReportedCommentRow>("reported-comments");
  const { data: reviews } = useDbResource<Review>("reviews");

  const sections = [
    {
      href: "/dashboard/reports/products",
      icon: Package,
      title: "Reported Products",
      description: "Listings flagged for counterfeits, stolen images, or policy violations",
      count: (products ?? []).length,
      tone: "red",
    },
    {
      href: "/dashboard/reports/messages",
      icon: MessageCircle,
      title: "Reported Messages",
      description: "Chat threads reported for scams, spam, or harassment",
      count: (messages ?? []).length,
      tone: "amber",
    },
    {
      href: "/dashboard/reports/communities",
      icon: UsersRound,
      title: "Reported Communities",
      description: "Communities flagged by members or moderators",
      count: (communities ?? []).filter((c) => c.reports > 0).length,
      tone: "red",
    },
    {
      href: "/dashboard/reports/comments",
      icon: MessageSquare,
      title: "Reported Comments",
      description: "Comments flagged across communities and posts",
      count: (comments ?? []).length,
      tone: "amber",
    },
    {
      href: "/dashboard/reports/reviews",
      icon: Star,
      title: "Reported Reviews",
      description: "Reviews flagged as fake, abusive, or off-topic",
      count: (reviews ?? []).filter((r) => r.status === "reported").length,
      tone: "violet",
    },
  ];

  const totalPending = sections.reduce((s, x) => s + x.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Reports Queue</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">
          {totalPending} reported items waiting for review across all content types.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="group">
              <Card className="transition-colors group-hover:border-[#6C3BFF]/40">
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONES[s.tone]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="danger">{s.count} pending</Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-1">
                    <h3 className="text-[15px] font-semibold text-[#18181B]">{s.title}</h3>
                    <ChevronRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-1 text-[13px] text-[#71717A]">{s.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}