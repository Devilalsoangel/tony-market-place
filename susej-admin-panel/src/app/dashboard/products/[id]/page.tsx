"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch, apiDelete } from "@/lib/api-mutate";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  ArrowLeft, Package, Store, Tag, Calendar, Flag, Star, ShieldCheck,
  EyeOff, Trash2, Sparkles, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import type { Product } from "@/types";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: products, refresh } = useDbResource<Product>("products");
  const [activeImage, setActiveImage] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);

  const fetched = useMemo(() => products?.find((p) => p.id === id) ?? null, [products, id]);

  useEffect(() => {
    if (fetched) setProduct(fetched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!product) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Products", href: "/dashboard/products" }, { label: "Product" }]} />
        <EmptyState
          icon={<Package className="h-8 w-8 text-gray-300" />}
          title="Product not found"
          description={`No product exists with ID ${id}.`}
          action={
            <Link href="/dashboard/products">
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" /> Back to Products
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  function patchProduct(patch: Partial<Product>) {
    const current = product;
    if (!current) return;
    setProduct({ ...current, ...patch });
    void apiPatch("products", current.id, patch);
  }

  function deleteProduct() {
    const current = product;
    if (!current) return;
    void apiDelete("products", current.id);
    setDeleteOpen(false);
    window.location.href = "/dashboard/products";
  }

  // Demo AI-detection scores derived deterministically from the reports count
  const aiScores = [
    { label: "Spam", score: Math.min(96, 15 + product.reports * 11) },
    { label: "Duplicate", score: Math.min(92, 10 + product.reports * 9) },
    { label: "Copyright", score: Math.min(88, 8 + product.reports * 7) },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Products", href: "/dashboard/products" }, { label: product.title }]} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.images[0]}
            alt={product.title}
            className="h-16 w-16 rounded-2xl border border-[#E4E4E7] object-cover"
          />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#18181B] ">{product.title}</h1>
              <StatusBadge status={product.status} />
              <Badge variant={product.reports > 0 ? "danger" : "default"}>
                <Flag className="mr-1 h-3 w-3" /> {product.reports} reports
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {product.category} &middot; Listed by {product.sellerName} &middot; {formatDate(product.createdAt, "long")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {product.status !== "featured" && (
            <Button variant="outline" onClick={() => patchProduct({ status: "featured" })}>
              <Star className="h-4 w-4" /> Feature
            </Button>
          )}
          {product.status === "hidden" ? (
            <Button variant="secondary" onClick={() => patchProduct({ status: "active" })}>
              <ShieldCheck className="h-4 w-4" /> Unhide
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => patchProduct({ status: "hidden" })}>
              <EyeOff className="h-4 w-4" /> Hide
            </Button>
          )}
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left: gallery */}
        <div className="col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.images[activeImage]}
                  alt={`${product.title} image ${activeImage + 1}`}
                  className="h-80 w-full object-cover"
                />
              </div>
              {product.images.length > 1 && (
                <div className="mt-3 flex gap-2">
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`overflow-hidden rounded-lg border-2 transition-colors ${
                        i === activeImage ? "border-[#6C3BFF]" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Thumbnail ${i + 1}`} className="h-16 w-16 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Content Detection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiScores.map((s) => (
                  <div key={s.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Sparkles className="h-3.5 w-3.5 text-[#6C3BFF]" /> {s.label}
                      </span>
                      <span className={s.score >= 60 ? "font-medium text-[#EF4444]" : "font-medium text-[#16A34A]"}>
                        {s.score >= 60 ? "Flagged" : "Clean"} &middot; {s.score}%
                      </span>
                    </div>
                    <Progress value={s.score} variant={s.score >= 60 ? "danger" : "success"} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: details */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Listing Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <Tag className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="text-xl font-bold text-[#18181B] ">{formatCurrency(product.price)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <Store className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Seller</p>
                    <p className="text-sm font-medium text-[#18181B] ">{product.sellerName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <Package className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Category</p>
                    <p className="text-sm font-medium text-[#18181B] ">{product.category}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <Calendar className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm font-medium text-[#18181B] ">{formatDate(product.createdAt, "long")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Moderation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-[#FAFAFA] px-4 py-3 text-sm">
                <p className="text-gray-500">Reported {product.reports} times</p>
              </div>
              {product.warningReason && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-amber-700">Warning issued</p>
                    <p className="text-xs text-amber-600">{product.warningReason}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => patchProduct({ warningReason: null })}>
                    Clear
                  </Button>
                </div>
              )}
              <div className="mt-3 space-y-2">
                {product.reports > 0 ? (
                  <p className="text-xs text-gray-500">
                    Review the listing against the marketplace content policy before deciding. Reporting
                    sellers repeatedly may warrant account-level review.
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">No user reports against this listing.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <div className="p-6 text-center">
          <Trash2 className="mx-auto h-10 w-10 text-[#EF4444]" />
          <h3 className="mt-3 text-lg font-semibold text-[#18181B] ">Delete Listing</h3>
          <p className="mt-2 text-sm text-gray-500">
            Permanently delete <strong>{product.title}</strong>? This removes it from the marketplace.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={deleteProduct}>Delete Listing</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}