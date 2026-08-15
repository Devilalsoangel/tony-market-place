"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { DocumentViewer } from "@/components/shared/document-viewer";
import { VerificationChecklist } from "@/components/shared/verification-checklist";
import { AuditTimeline } from "@/components/shared/audit-timeline";
import { AdminActionBar } from "@/components/shared/admin-action-bar";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch, apiPost } from "@/lib/api-mutate";
import { formatDate, formatNumber } from "@/lib/utils";
import { ArrowLeft, FileText, CheckCircle2, MapPin, Phone, Mail, Hash } from "lucide-react";
import Link from "next/link";
import type { Seller, SellerDocument } from "@/types";

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6C3BFF]/10 text-[#6C3BFF]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="truncate text-sm font-medium text-[#18181B] ">{value}</p>
      </div>
    </div>
  );
}

const docTypeLabels: Record<string, string> = {
  government_id: "Government ID",
  business_license: "Business License",
  address_proof: "Address Proof",
  gst_certificate: "GST Certificate",
  store_logo: "Store Logo",
  additional: "Additional Document",
};

export default function SellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: sellers, refresh } = useDbResource<Seller>("sellers");
  const [viewingDoc, setViewingDoc] = useState<SellerDocument | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);

  const fetched = useMemo(() => sellers?.find((s) => s.id === id) ?? null, [sellers, id]);

  useEffect(() => {
    if (fetched) setSeller(fetched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!seller) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Sellers", href: "/dashboard/sellers" }, { label: "Seller" }]} />
        <EmptyState
          icon={<FileText className="h-8 w-8 text-gray-300" />}
          title="Seller not found"
          description={`No seller exists with ID ${id}.`}
          action={
            <Link href="/dashboard/sellers">
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" /> Back to Sellers
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const verifiedDocs = seller.documents.filter((d) => d.verified).length;

  function updateSeller(patch: Partial<Seller>) {
    const current = seller;
    if (!current) return;
    setSeller({ ...current, ...patch });
    void apiPatch("sellers", current.id, patch);
  }

  async function logAudit(action: string, note: string) {
    try {
      await apiPost("seller-audit-log", {
        sellerId: seller!.id,
        action,
        adminName: "Super Admin",
        note,
        timestamp: new Date().toISOString(),
      });
      refresh();
    } catch (e) {
      console.error(e);
    }
  }

  function handleApprove() {
    updateSeller({ kycStatus: "approved", gstStatus: "verified" });
    void logAudit("approved", "All documents verified and approved");
  }

  function handleReject(reason: string) {
    updateSeller({ kycStatus: "rejected" });
    void logAudit("rejected", reason);
  }

  function handleRequestDocuments(message: string) {
    updateSeller({ kycStatus: "pending" });
    void logAudit("requested_documents", message);
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Sellers", href: "/dashboard/sellers" }, { label: seller.businessName }]} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={seller.logo}
            alt={seller.businessName}
            className="h-16 w-16 rounded-2xl border border-[#E4E4E7] object-cover"
          />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#18181B] ">{seller.businessName}</h1>
              <StatusBadge status={seller.kycStatus} />
              <Badge variant={seller.gstStatus === "verified" ? "success" : seller.gstStatus === "pending" ? "warning" : "default"}>
                GST {seller.gstStatus}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {seller.ownerName} &middot; Submitted {formatDate(seller.submittedAt, "long")} &middot; Joined{" "}
              {formatDate(seller.joinedAt, "long")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[#E4E4E7] bg-white px-5 py-3 text-center">
            <p className="text-xs text-gray-500">Seller Score</p>
            <p className="text-xl font-bold text-[#6C3BFF]">{seller.score}</p>
          </div>
          <div className="rounded-xl border border-[#E4E4E7] bg-white px-5 py-3 text-center">
            <p className="text-xs text-gray-500">Products</p>
            <p className="text-xl font-bold text-[#18181B] ">{formatNumber(seller.productsCount)}</p>
          </div>
        </div>
      </div>

      {/* Actions for pending sellers */}
      {seller.kycStatus === "pending" && (
        <Card>
          <CardContent>
            <AdminActionBar
              status={seller.kycStatus}
              onApprove={handleApprove}
              onReject={handleReject}
              onRequestDocuments={handleRequestDocuments}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-5 gap-6">
        {/* Left: documents + checklist */}
        <div className="col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submitted Documents ({verifiedDocs}/{seller.documents.length} verified)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {seller.documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setViewingDoc(doc)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50 "
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                        <FileText className="h-5 w-5 text-[#6C3BFF]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#18181B] ">{docTypeLabels[doc.type] ?? doc.label}</p>
                        <p className="text-xs text-gray-500">{doc.fileName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{formatDate(doc.uploadedAt)}</span>
                      {doc.verified ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-[#16A34A]">
                          <CheckCircle2 className="h-4 w-4" /> Verified
                        </span>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <VerificationChecklist documents={seller.documents} />
            </CardContent>
          </Card>
        </div>

        {/* Right: business info + audit timeline */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={seller.email} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={seller.phone} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={seller.address} />
                <InfoRow icon={<Hash className="h-4 w-4" />} label="Tax ID" value={seller.taxId} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-gray-500">KYC completeness</span>
                <span className="font-medium text-[#18181B] ">{Math.round((verifiedDocs / seller.documents.length) * 100)}%</span>
              </div>
              <Progress
                value={Math.round((verifiedDocs / seller.documents.length) * 100)}
                variant={verifiedDocs === seller.documents.length ? "success" : "warning"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit History</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTimeline logs={seller.auditLogs} />
            </CardContent>
          </Card>
        </div>
      </div>

      <DocumentViewer document={viewingDoc} open={!!viewingDoc} onClose={() => setViewingDoc(null)} />
    </div>
  );
}