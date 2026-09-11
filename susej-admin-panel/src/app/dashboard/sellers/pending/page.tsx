"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatDate } from "@/lib/utils";
import { Eye, Clock } from "lucide-react";
import type { Seller } from "@/types";

export default function SellersPendingPage() {
  const { data: sellers } = useDbResource<Seller>("sellers");
  const pending = (sellers ?? []).filter((s) => s.kycStatus === "pending");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B]">Pending Verifications</h1>
          <p className="mt-1 text-sm text-gray-500">Review documents and approve or reject sellers — decisions propagate to user verification instantly.</p>
        </div>
        <Link href="/dashboard/sellers"><Button variant="secondary"><Clock className="h-4 w-4" /> All sellers</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Pending Queue ({pending.length})</CardTitle></CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-[#18181B]">No pending verifications</p>
              <p className="text-xs text-gray-500">New seller applications will appear here instantly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((s) => (
                <Link key={s.id} href={`/dashboard/sellers/${s.id}`}>
                  <div className="flex items-center justify-between rounded-xl border border-[#E4E4E7] px-5 py-4 hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6C3BFF]/10 text-lg font-bold text-[#6C3BFF]">{s.businessName[0]}</div>
                      <div>
                        <p className="font-medium text-[#18181B]">{s.businessName}</p>
                        <p className="text-sm text-gray-500">{s.ownerName} · {s.email} · {s.category ?? "No category"}</p>
                        <p className="text-xs text-gray-400">Submitted {formatDate(s.submittedAt)}</p>
                      </div>
                    </div>
                    <Button variant="primary" size="sm"><Eye className="h-4 w-4" /> Review</Button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
