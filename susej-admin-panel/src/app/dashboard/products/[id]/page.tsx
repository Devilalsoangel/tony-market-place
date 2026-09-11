"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch, apiDelete } from "@/lib/api-mutate";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  ArrowLeft, Package, Store, Tag, Calendar, Flag, Star, ShieldCheck,
  EyeOff, Trash2, CheckCircle2,
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
    if (!products) {
      return (
        <div className="space-y-6">
          <Breadcrumb items={[{ label: "Products", href: "/dashboard/products" }, { label: "Product" }]} />
          <div className="py-16 text-center text-sm text-[#A1A1AA]">Loading product…</div>
        </div>
      );
    }
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

  const imgs = Array.isArray(product.images) ? (product.images as string[]) : [];
  const thumbUrl = imgs[0] ?? null;

  function patchProduct(patch: Partial<Product>) {
    const current = product;
    if (!current) return;
    setProduct({ ...current, ...patch });
    void apiPatch("products", current.id, patch);
  }

  async function deleteProduct() {
    const current = product;
    if (!current) return;
    try {
      await apiDelete("products", current.id);
      window.location.href = "/dashboard/products";
    } catch {
      // keep dialog open on failure
    }
    setDeleteOpen(false);
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Products", href: "/dashboard/products" }, { label: "Product Details" }]} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
           {thumbUrl ? (
             // eslint-disable-next-line @next/next/no-img-element
             <img
               src={thumbUrl}
               alt={product.title}
               className="h-16 w-16 rounded-2xl border border-[#E4E4E7] object-cover"
             />
           ) : (
             <div className="h-16 w-16 rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] flex items-center justify-center">
               <Package className="h-6 w-6 text-gray-300" />
             </div>
           )}
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
          {product.status === "featured" ? (
            <Button variant="outline" onClick={() => patchProduct({ status: "active" })}>
              <Star className="h-4 w-4" /> Unfeature
            </Button>
          ) : (
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
              <div className="relative overflow-hidden rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]">
                 {thumbUrl ? (
                   <>
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img
                       src={imgs[activeImage] ?? thumbUrl}
                       alt={`${product.title} image ${activeImage + 1}`}
                       className="h-80 w-full object-cover"
                     />
                     {/* Carousel dots overlay - bottom center of image */}
                     {imgs.length > 1 && (
                       <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/40 rounded-full px-2.5 py-1">
                         {imgs.map((_, i) => (
                           <button
                             key={i}
                             onClick={() => setActiveImage(i)}
                             className={`h-2 w-2 rounded-full transition-colors ${
                               i === activeImage ? "bg-white" : "bg-white/50"
                             }`}
                           />
                         ))}
                       </div>
                     )}
                   </>
                 ) : (
                   <div className="h-80 w-full flex flex-col items-center justify-center gap-2">
                     <Package className="h-10 w-10 text-gray-300" />
                     <p className="text-sm text-gray-400">No images</p>
                   </div>
                 )}
               </div>
               {imgs.length > 1 && (
                 <div className="mt-2 flex gap-2">
                   {imgs.map((img, i) => (
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
              <div className="space-y-3">
                {product.reports > 0 ? (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                    <p className="text-sm font-medium text-red-700">Reported {product.reports} time{product.reports > 1 ? 's' : ''}</p>
                    <p className="text-xs text-red-500 mt-1">Review the listing against the marketplace content policy before deciding. Reporting sellers repeatedly may warrant account-level review.</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                    <p className="text-sm font-medium text-green-700">No reports</p>
                    <p className="text-xs text-green-500 mt-1">This listing has no user reports against it.</p>
                  </div>
                )}
                {product.warningReason && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-amber-700">Warning issued</p>
                      <p className="text-xs text-amber-600">{product.warningReason}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => patchProduct({ warningReason: null })}>
                      Clear
                    </Button>
                  </div>
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