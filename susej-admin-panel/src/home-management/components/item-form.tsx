"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { fetchPosts, fetchProducts, fetchSellers } from "@/services/home-records";
import { useHomeManagement } from "@/home-management/context";
import { SECTION_CONFIG, type SectionKind } from "./section-config";
import { SearchableSelect, type SearchableOption } from "./searchable-select";
import type {
  HotDeal,
  StorefrontBanner,
  TopSeller,
} from "@/types/home-management";

type AnyItem = TopSeller | HotDeal | StorefrontBanner;
type FormState = Record<string, string | number | boolean>;

const ID_PREFIX: Record<SectionKind, string> = {
  "top-sellers": "ts",
  "hot-deals": "hd",
  "storefront-banners": "sb",
};

const newId = (prefix: string) => `${prefix}-${Date.now()}`;

const STATUS_OPTIONS: Record<SectionKind, { label: string; value: string }[]> = {
  "top-sellers": [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ],
  "hot-deals": [
    { label: "Active", value: "active" },
    { label: "Expired", value: "expired" },
    { label: "Inactive", value: "inactive" },
  ],
  "storefront-banners": [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ],
};

const REQUIRED_FIELDS: Record<SectionKind, string[]> = {
  "top-sellers": ["sellerName"],
  "hot-deals": ["productName"],
  "storefront-banners": ["title", "sellerUsername"],
};

function Field({
  label,
  error,
  fieldKey,
  children,
}: {
  label: string;
  error?: string;
  fieldKey?: string;
  children: React.ReactNode;
}) {
  return (
    <label id={fieldKey ? `form-field-${fieldKey}` : undefined} className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700 ">
        {label} {error && <span className="ml-1 text-xs font-semibold text-[#EF4444]">Â· {error}</span>}
      </span>
      {children}
    </label>
  );
}

function RecordPreview({ src, label }: { src: string; label: string }) {
  if (!src) {
    return (
      <div className="mt-2 flex h-32 items-center justify-center rounded-2xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] ">
        <p className="text-sm text-gray-400">No image</p>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={label}
      className="mt-2 h-40 w-full rounded-2xl border border-[#E4E4E7] object-cover"
    />
  );
}

export function ItemFormPage({
  kind,
  editingId,
  onClose,
}: {
  kind: SectionKind;
  editingId?: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { state, actions } = useHomeManagement();
  const config = SECTION_CONFIG[kind];

  const items: AnyItem[] =
    kind === "top-sellers"
      ? state.topSellers
      : kind === "hot-deals"
        ? state.hotDeals
        : state.storefrontBanners;

  const editingItem = editingId ? items.find((i) => i.id === editingId) : undefined;

  const itemToForm = (item: AnyItem): FormState => {
    const copy: Record<string, string | number | boolean> = { ...item };
    delete copy.createdAt;
    delete copy.updatedAt;
    return copy;
  };

  const emptyForm = (): FormState => {
    const position = items.length + 1;
    switch (kind) {
      case "top-sellers":
        return {
          sellerName: "",
          sellerId: newId("sel"),
          sellerLogo: "",
          totalSales: 0,
          rating: 0,
          reviewCount: 0,
          position,
          isPinned: false,
          status: "active",
        };
      case "hot-deals":
        return {
          productName: "",
          productId: newId("prod"),
          productImage: "",
          originalPrice: 0,
          discountedPrice: 0,
          discountPercentage: 0,
          startDate: "",
          endDate: "",
          priority: position,
          status: "active",
        };
      case "storefront-banners":
        return {
          sellerUsername: "",
          sellerName: "",
          title: "",
          subtitle: "",
          ctaLabel: "",
          imageUrl: "",
          status: "active",
        };
    }
  };

  const [form, setForm] = useState<FormState>(() => (editingItem ? itemToForm(editingItem) : emptyForm()));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Live records for the destination pickers — fetched from the real DB.
  const [recordData, setRecordData] = useState<{
    products: Awaited<ReturnType<typeof fetchProducts>>;
    sellers: Awaited<ReturnType<typeof fetchSellers>>;
    posts: Awaited<ReturnType<typeof fetchPosts>>;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchProducts(), fetchSellers(), fetchPosts()])
      .then(([products, sellers, posts]) => {
        if (alive) setRecordData({ products, sellers, posts });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const EMPTY_OPTIONS: Record<string, SearchableOption[]> = useMemo(() => ({ product: [], seller: [], post: [] }), []);
  const recordOptions: Record<string, SearchableOption[]> = useMemo(() => {
    if (!recordData) return EMPTY_OPTIONS;
    return {
      product: recordData.products.map((p) => ({ label: p.title, value: p.id, image: p.images[0] })),
      seller: recordData.sellers.map((s) => ({ label: s.businessName, value: s.id, image: s.logo || undefined })),
      post: recordData.posts.map((p) => ({ label: p.title, value: p.id, image: p.imageUrl })),
    };
  }, [recordData, EMPTY_OPTIONS]);

  if (editingId && !editingItem) {
    return (
      <div className="mx-auto max-w-2xl rounded-[20px] border border-[#E4E4E7] bg-white p-8 text-center ">
        <h1 className="text-lg font-bold text-[#18181B] ">Item not found</h1>
        <p className="mt-1 text-sm text-gray-500">It may have been deleted.</p>
      </div>
    );
  }

  const setField = (key: string, value: string | number | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const str = (key: string) => String(form[key] ?? "");
  const num = (key: string) => Number(form[key] ?? 0);

  const pickSeller = (id: string) => {
    const rec = recordData?.sellers.find((s) => s.id === id);
    setField("sellerId", id);
    setField("sellerName", rec?.businessName ?? "");
    setField("sellerLogo", rec?.logo ?? "");
  };

  const pickProduct = (id: string) => {
    const rec = recordData?.products.find((p) => p.id === id);
    setField("productId", id);
    setField("productName", rec?.title ?? "");
    setField("productImage", rec?.images[0] ?? "");
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    for (const key of REQUIRED_FIELDS[kind]) {
      if (!str(key).trim()) errs[key] = "This field is required";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const order = [
        ...REQUIRED_FIELDS[kind],
        ...Object.keys(errs).filter((k) => !REQUIRED_FIELDS[kind].includes(k)),
      ];
      const first = order.find((k) => errs[k]);
      if (first) {
        requestAnimationFrame(() => {
          const el = document.getElementById(`form-field-${first}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          el?.querySelector<HTMLElement>("input, button, select")?.focus({ preventScroll: true });
        });
      }
    }
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    const id = editingId ?? newId(ID_PREFIX[kind]);
    const now = new Date().toISOString();
    let item: AnyItem;
    switch (kind) {
      case "top-sellers":
        item = {
          id,
          sellerId: str("sellerId"),
          sellerName: str("sellerName"),
          sellerLogo: str("sellerLogo"),
          totalSales: num("totalSales"),
          rating: num("rating"),
          reviewCount: num("reviewCount"),
          position: num("position"),
          isPinned: Boolean(form.isPinned),
          status: str("status") as TopSeller["status"],
          createdAt: now,
          updatedAt: now,
        } as TopSeller;
        if (editingId) await actions.updateTopSeller(id, item as TopSeller);
        else await actions.addTopSeller(item as TopSeller);
        break;
      case "hot-deals":
        item = {
          id,
          productId: str("productId"),
          productName: str("productName"),
          productImage: str("productImage"),
          originalPrice: num("originalPrice"),
          discountedPrice: num("discountedPrice"),
          discountPercentage:
            num("originalPrice") > 0
              ? Math.round(((num("originalPrice") - num("discountedPrice")) / num("originalPrice")) * 100)
              : 0,
          startDate: str("startDate"),
          endDate: str("endDate"),
          priority: num("priority"),
          status: str("status") as HotDeal["status"],
          createdAt: now,
          updatedAt: now,
        } as HotDeal;
        if (editingId) await actions.updateHotDeal(id, item as HotDeal);
        else await actions.addHotDeal(item as HotDeal);
        break;
      case "storefront-banners":
        item = {
          id,
          sellerUsername: str("sellerUsername"),
          sellerName: str("sellerName"),
          title: str("title"),
          subtitle: str("subtitle"),
          ctaLabel: str("ctaLabel"),
          imageUrl: str("imageUrl"),
          status: str("status") as StorefrontBanner["status"],
          createdAt: now,
          updatedAt: now,
        } as StorefrontBanner;
        if (editingId) await actions.updateStorefrontBanner(id, item as StorefrontBanner);
        // No add for banners — they sync from seller app
        break;
    }
    toast.success(`${editingId ? "Updated" : "Added"} ${config.singular} successfully`);
    if (onClose) onClose();
    else router.push(`/dashboard/home-management?section=${kind}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div
        className={
          onClose
            ? ""
            : "rounded-[20px] border border-[#E4E4E7] bg-white p-6 shadow-sm "
        }
      >
        <h1 className="text-xl font-bold text-[#18181B] ">
          {editingId ? "Edit" : "Add"} {config.singular}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{config.title} Â· home page</p>

        <div className="mt-5 space-y-3">
          {kind === "top-sellers" && (
            <>
              <Field label="Seller" error={errors.sellerName} fieldKey="sellerName">
                <SearchableSelect
                  options={recordOptions.seller}
                  value={str("sellerId")}
                  onChange={pickSeller}
                  fallbackLabel={str("sellerName")}
                  placeholder="Search sellers..."
                  emptyText="No matching sellers"
                />
              </Field>
              <Field label="Seller photo">
                <RecordPreview src={str("sellerLogo")} label="seller logo" />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Total sales">
                  <Input type="number" min={0} value={String(num("totalSales"))} onChange={(e) => setField("totalSales", Number(e.target.value))} />
                </Field>
                <Field label="Rating">
                  <Input type="number" min={0} max={5} step={0.1} value={String(num("rating"))} onChange={(e) => setField("rating", Number(e.target.value))} />
                </Field>
                <Field label="Reviews">
                  <Input type="number" min={0} value={String(num("reviewCount"))} onChange={(e) => setField("reviewCount", Number(e.target.value))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Position">
                  <Input type="number" min={1} value={String(num("position"))} onChange={(e) => setField("position", Number(e.target.value))} />
                </Field>
                <Field label="Status">
                  <Select options={STATUS_OPTIONS[kind]} value={str("status")} onChange={(e) => setField("status", e.target.value)} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 ">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#6C3BFF]"
                  checked={Boolean(form.isPinned)}
                  onChange={(e) => setField("isPinned", e.target.checked)}
                />
                Pinned top-of-list
              </label>
            </>
          )}

          {kind === "hot-deals" && (
            <>
              <Field label="Product" error={errors.productName} fieldKey="productName">
                <SearchableSelect
                  options={recordOptions.product}
                  value={str("productId")}
                  onChange={pickProduct}
                  fallbackLabel={str("productName")}
                  placeholder="Search products..."
                  emptyText="No matching products"
                />
              </Field>
              <Field label="Product image">
                <RecordPreview src={str("productImage")} label="product image" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Original price (₹)">
                  <Input type="number" min={0} step={0.01} value={String(num("originalPrice"))} onChange={(e) => setField("originalPrice", Number(e.target.value))} />
                </Field>
                <Field label="Discounted price (₹)">
                  <Input type="number" min={0} step={0.01} value={String(num("discountedPrice"))} onChange={(e) => setField("discountedPrice", Number(e.target.value))} />
                </Field>
              </div>
              {num("originalPrice") > 0 && (
                <p className="text-xs text-gray-500">
                  Discount:{" "}
                  <span className="font-semibold text-[#EF4444]">
                    -{Math.round(((num("originalPrice") - num("discountedPrice")) / num("originalPrice")) * 100)}%
                  </span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date">
                  <Input type="date" value={str("startDate")} onChange={(e) => setField("startDate", e.target.value)} />
                </Field>
                <Field label="End date">
                  <Input type="date" value={str("endDate")} onChange={(e) => setField("endDate", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <Input type="number" min={1} value={String(num("priority"))} onChange={(e) => setField("priority", Number(e.target.value))} />
                </Field>
                <Field label="Status">
                  <Select options={STATUS_OPTIONS[kind]} value={str("status")} onChange={(e) => setField("status", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {kind === "storefront-banners" && (
            <>
              <Field label="Seller username" error={errors.sellerUsername} fieldKey="sellerUsername">
                <Input value={str("sellerUsername")} onChange={(e) => setField("sellerUsername", e.target.value)} />
              </Field>
              <Field label="Seller name">
                <Input value={str("sellerName")} onChange={(e) => setField("sellerName", e.target.value)} />
              </Field>
              <Field label="Banner title" error={errors.title} fieldKey="title">
                <Input value={str("title")} onChange={(e) => setField("title", e.target.value)} />
              </Field>
              <Field label="Subtitle">
                <Input value={str("subtitle")} onChange={(e) => setField("subtitle", e.target.value)} />
              </Field>
              <Field label="CTA label">
                <Input value={str("ctaLabel")} onChange={(e) => setField("ctaLabel", e.target.value)} />
              </Field>
              <Field label="Banner image">
                <RecordPreview src={str("imageUrl")} label="banner image" />
              </Field>
              <Field label="Status">
                <Select options={STATUS_OPTIONS[kind]} value={str("status")} onChange={(e) => setField("status", e.target.value)} />
              </Field>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => (onClose ? onClose() : router.push(`/dashboard/home-management?section=${kind}`))}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSave()}>Save {config.singular}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}