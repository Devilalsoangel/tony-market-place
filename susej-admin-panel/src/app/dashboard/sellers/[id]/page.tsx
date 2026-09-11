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
import { useAuthStore } from "@/store/auth-store";
import { ArrowLeft, FileText, CheckCircle2, MapPin, Phone, Mail, Hash, Store, ShieldCheck, User, CreditCard, Calendar, ExternalLink } from "lucide-react";
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
  government_id_back: "Government ID (back)",
  business_license: "Business License",
  address_proof: "Address Proof",
  gst_certificate: "GST Certificate",
  store_logo: "Store Logo",
  additional: "Additional Document",
};

// Mask a 12-digit Aadhaar for the list view; the full number opens on reveal.
function maskIdNumber(idType: string | null | undefined, num: string | null | undefined): string {
  const v = String(num ?? "").trim();
  if (!v) return "Not provided";
  if ((idType ?? "").toLowerCase() === "aadhaar" && /^\d{12}$/.test(v)) {
    return `XXXX-XXXX-${v.slice(-4)}`;
  }
  return v;
}

function initialsOf(name: string): string {
  const t = String(name ?? "").trim();
  return (t[0] ?? "S").toUpperCase();
}

// Identity Verification — mirrors the become-a-seller step-3 sections 1:1 so
// the admin sees exactly what the seller sent: ID type + number (masked with
// reveal), name-on-ID, DOB, face-match photos, address proof, tax rows.
function IdentityCard({ seller, onView }: { seller: Seller; onView: (d: SellerDocument) => void }) {
  const [revealed, setRevealed] = useState(false);
  const docs = seller.documents ?? [];
  const front = docs.find((d) => d.type === "government_id") ?? null;
  const back = docs.find((d) => d.type === "government_id_back") ?? null;
  const addrDoc = docs.find((d) => d.type === "address_proof") ?? null;
  const selfieDoc: SellerDocument | null =
    docs.find((d) => d.type === "additional" && /selfie/i.test(d.label)) ??
    (seller.selfieUrl
      ? {
          id: "selfie-url",
          type: "additional",
          label: "Selfie with ID",
          fileName: "selfie-with-id.jpg",
          url: seller.selfieUrl,
          uploadedAt: seller.submittedAt,
          verified: false,
        }
      : null);
  const idLabel =
    (seller.idType ?? "").toLowerCase() === "aadhaar"
      ? "Aadhaar"
      : (seller.idType ?? "").toLowerCase() === "pan"
        ? "PAN"
        : (seller.idType ?? "").toLowerCase() === "passport"
          ? "Passport"
          : seller.idType || "ID document";
  const hasIdentity =
    !!seller.idType || !!seller.idNumber || !!seller.nameOnId || !!seller.dob || docs.length > 0;
  const photos = [
    front && { doc: front, caption: `Front of ${idLabel}` },
    back && { doc: back, caption: `Back of ${idLabel}` },
    selfieDoc && { doc: selfieDoc, caption: "Selfie with ID" },
    addrDoc && { doc: addrDoc, caption: "Address proof" },
  ].filter((x): x is { doc: SellerDocument; caption: string } => !!x);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identity Verification</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasIdentity ? (
          <p className="text-sm text-gray-500">No identity details submitted yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-4">
              <InfoRow
                icon={<ShieldCheck className="h-4 w-4" />}
                label={`${idLabel} number`}
                value={revealed ? String(seller.idNumber ?? "Not provided") : maskIdNumber(seller.idType, seller.idNumber)}
              />
              {String(seller.idNumber ?? "").trim() && (
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  className="ml-11 text-xs font-medium text-[#6C3BFF] hover:underline"
                >
                  {revealed ? "Hide full number" : "Reveal full number"}
                </button>
              )}
              <InfoRow icon={<User className="h-4 w-4" />} label="Name (as on ID)" value={seller.nameOnId || "Not provided"} />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date of birth" value={seller.dob || "Not provided"} />
              {!!seller.pan && (
                <InfoRow icon={<CreditCard className="h-4 w-4" />} label="PAN" value={seller.pan} />
              )}
              {!!seller.bankAccount && (
                <InfoRow icon={<Hash className="h-4 w-4" />} label="Bank account" value={seller.bankAccount} />
              )}
            </div>
            {photos.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Face match</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {photos.map(({ doc, caption }) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => onView(doc)}
                      className="group overflow-hidden rounded-xl border border-[#E4E4E7] bg-white text-left transition-colors hover:border-[#6C3BFF]/50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={doc.url} alt={caption} className="h-24 w-full object-cover" loading="lazy" />
                      <p className="truncate px-2 py-1.5 text-xs text-gray-600">{caption}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No identity photos uploaded yet.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: sellers, refresh } = useDbResource<Seller>("sellers");
  const { data: categoryRows } = useDbResource<{ id: string; name: string }>("categories");
  const adminUser = useAuthStore((s) => s.user);
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

  const verifiedDocs = (seller.documents ?? []).filter((d) => d.verified).length;

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
        adminName: adminUser?.name || "Admin",
        note,
        timestamp: new Date().toISOString(),
      });
      refresh();
    } catch (e) {
      console.error(e);
    }
  }

  function handleApprove() {
    // Approving means every submitted doc was reviewed: mark them verified
    // too, or progress stays 0% on an approved seller (was the case before).
    const docs = seller?.documents ?? [];
    if (docs.some((d) => !d.verified)) {
      setSeller((s) =>
        s ? { ...s, kycStatus: "approved", gstStatus: "verified", documents: s.documents.map((d) => ({ ...d, verified: true })) } : s
      );
      void apiPatch("sellers", seller!.id, { kycStatus: "approved", gstStatus: "verified" });
      void Promise.all(
        docs.filter((d) => !d.verified).map((d) => apiPatch("seller-documents", d.id, { verified: true }).catch(() => null))
      ).then(() => refresh());
    } else {
      updateSeller({ kycStatus: "approved", gstStatus: "verified" });
    }
    void logAudit("approved", "All documents verified and approved");
  }

  // Per-document verify toggle (industry: reviewers check each file, not just
  // the whole application). Persists to seller-documents; row + checklist +
  // progress all derive from the same flags.
  function toggleDocVerified(doc: SellerDocument) {
    const next = !doc.verified;
    setSeller((s) =>
      s ? { ...s, documents: s.documents.map((d) => (d.id === doc.id ? { ...d, verified: next } : d)) } : s
    );
    void apiPatch("seller-documents", doc.id, { verified: next })
      .catch(() => {
        // Roll back the optimistic flip so the desk never shows a lie.
        setSeller((s) =>
          s ? { ...s, documents: s.documents.map((d) => (d.id === doc.id ? { ...d, verified: doc.verified } : d)) } : s
        );
      })
      .then(() => refresh());
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
          {seller.logo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={seller.logo}
              alt={seller.businessName}
              className="h-16 w-16 rounded-2xl border border-[#E4E4E7] object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E4E4E7] bg-[#6C3BFF]/10 text-2xl font-bold text-[#6C3BFF]">
              {initialsOf(seller.businessName)}
            </div>
          )}
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
        {/* Left: identity + documents + checklist */}
        <div className="col-span-3 space-y-6">
          <IdentityCard seller={seller} onView={(d) => setViewingDoc(d)} />
          <Card>
            <CardHeader>
              <CardTitle>Submitted Documents ({verifiedDocs}/{seller.documents.length} verified)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {seller.documents.map((doc) => (
                  <div
                    key={doc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setViewingDoc(doc)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setViewingDoc(doc);
                    }}
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50 "
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDocVerified(doc);
                        }}
                      >
                        {doc.verified ? "Unverify" : "Verify"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <VerificationChecklist documents={seller.documents} seller={seller} />
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
                {/* One-shop-one-category: admins correct a store's main category
                    here; the change propagates to the app's User row via the
                    sellers PATCH route. Options come from the live catalog. */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6C3BFF]/10 text-[#6C3BFF]">
                    <Store className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">Store Category (one per shop)</p>
                    <select
                      value={seller.category ?? ""}
                      onChange={(e) => {
                        const next = e.target.value;
                        setSeller((s) => (s ? { ...s, category: next || undefined } : s));
                        void apiPatch("sellers", seller.id, { category: next });
                      }}
                      className="mt-1 w-full max-w-xs rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-sm font-medium text-[#18181B] focus:border-[#6C3BFF] focus:outline-none"
                    >
                      <option value="">Not set</option>
                      {(categoryRows ?? []).map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={seller.address} />
                {(seller.storeAddress || (seller.storeLat != null && seller.storeLng != null)) && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6C3BFF]/10 text-[#6C3BFF]">
                      <Store className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500">Store location (pinned on map)</p>
                      <p className="truncate text-sm font-medium text-[#18181B] ">
                        {seller.storeAddress || `${seller.storeLat}, ${seller.storeLng}`}
                      </p>
                      {seller.storeLat != null && seller.storeLng != null && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${seller.storeLat},${seller.storeLng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#6C3BFF] hover:underline"
                        >
                          Open in Maps <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
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
                {/* Guard divide-by-zero: a seller with zero documents must show
                    0% — not NaN — so the queue honestly flags missing docs. */}
                <span className="font-medium text-[#18181B] ">
                  {seller.documents.length > 0 ? Math.round((verifiedDocs / seller.documents.length) * 100) : 0}%
                </span>
              </div>
              <Progress
                value={seller.documents.length > 0 ? Math.round((verifiedDocs / seller.documents.length) * 100) : 0}
                variant={seller.documents.length > 0 && verifiedDocs === seller.documents.length ? "success" : "warning"}
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