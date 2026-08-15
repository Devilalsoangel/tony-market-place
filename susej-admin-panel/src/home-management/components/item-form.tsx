"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { getCategories, getPosts, getProducts, getSellers } from "@/services/home-records";
import { useHomeManagement } from "@/home-management/context";
import { SECTION_CONFIG, type SectionKind } from "./section-config";
import { ImageUpload } from "./image-upload";
import { SearchableSelect, type SearchableOption } from "./searchable-select";
import type {
  FeaturedCategory,
  FeaturedPost,
  HeroBanner,
  HotDeal,
  TopSeller,
} from "@/types/home-management";

type AnyItem = HeroBanner | FeaturedCategory | TopSeller | HotDeal | FeaturedPost;
type FormState = Record<string, string | number | boolean>;

const ID_PREFIX: Record<SectionKind, string> = {
  "hero-banners": "hb",
  "featured-categories": "fc",
  "top-sellers": "ts",
  "hot-deals": "hd",
  "featured-posts": "fp",
};

const newId = (prefix: string) => `${prefix}-${Date.now()}`;

const STATUS_OPTIONS: Record<SectionKind, { label: string; value: string }[]> = {
  "hero-banners": [
    { label: "Active", value: "active" },
    { label: "Scheduled", value: "scheduled" },
    { label: "Inactive", value: "inactive" },
  ],
  "featured-categories": [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ],
  "top-sellers": [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ],
  "hot-deals": [
    { label: "Active", value: "active" },
    { label: "Expired", value: "expired" },
    { label: "Inactive", value: "inactive" },
  ],
  "featured-posts": [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ],
};

const ACTION_OPTIONS = [
  { label: "Product", value: "product" },
  { label: "Category", value: "category" },
  { label: "Seller", value: "seller" },
  { label: "External link", value: "external" },
];

const RECORD_OPTIONS: Record<string, SearchableOption[]> = {
  product: getProducts().map((p) => ({ label: p.title, value: p.id, image: p.images[0] })),
  category: getCategories().map((c) => ({ label: c.name, value: c.id, image: c.bannerImage || undefined })),
  seller: getSellers().map((s) => ({ label: s.businessName, value: s.id, image: s.logo || undefined })),
  post: getPosts().map((p) => ({ label: p.title, value: p.id, image: p.imageUrl })),
};

const REQUIRED_FIELDS: Record<SectionKind, string[]> = {
  "hero-banners": ["title", "buttonText"],
  "featured-categories": ["categoryName"],
  "top-sellers": ["sellerName"],
  "hot-deals": ["productName"],
  "featured-posts": ["title"],
};

const ACTION_LABEL: Record<string, string> = {
  product: "Product",
  category: "Category",
  seller: "Seller",
};

const findRecord = (kind: "product" | "category" | "seller" | "post", id: string) => {
  switch (kind) {
    case "product":
      return getProducts().find((r) => r.id === id);
    case "category":
      return getCategories().find((r) => r.id === id);
    case "seller":
      return getSellers().find((r) => r.id === id);
    case "post":
      return getPosts().find((r) => r.id === id);
  }
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
    kind === "hero-banners"
      ? state.heroBanners
      : kind === "featured-categories"
        ? state.featuredCategories
        : kind === "top-sellers"
          ? state.topSellers
          : kind === "hot-deals"
            ? state.hotDeals
            : state.featuredPosts;

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
      case "hero-banners":
        return {
          title: "",
          subtitle: "",
          imageUrl: "",
          buttonText: "Shop Now",
          buttonAction: "product",
          destinationId: "",
          destinationUrl: "",
          startDate: "",
          endDate: "",
          status: "active",
        };
      case "featured-categories":
        return { categoryName: "", categoryId: newId("cat"), imageUrl: "", position, status: "active" };
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
      case "featured-posts":
        return {
          postId: newId("post"),
          title: "",
          excerpt: "",
          imageUrl: "",
          position,
          isPinned: false,
          status: "active",
          startDate: "",
          endDate: "",
        };
    }
  };

  const [form, setForm] = useState<FormState>(() => (editingItem ? itemToForm(editingItem) : emptyForm()));
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const pickCategory = (id: string) => {
    const rec = getCategories().find((c) => c.id === id);
    setField("categoryId", id);
    setField("categoryName", rec?.name ?? "");
    setField("imageUrl", rec?.bannerImage ?? "");
  };

  const pickSeller = (id: string) => {
    const rec = getSellers().find((s) => s.id === id);
    setField("sellerId", id);
    setField("sellerName", rec?.businessName ?? "");
    setField("sellerLogo", rec?.logo ?? "");
  };

  const pickProduct = (id: string) => {
    const rec = getProducts().find((p) => p.id === id);
    setField("productId", id);
    setField("productName", rec?.title ?? "");
    setField("productImage", rec?.images[0] ?? "");
  };

  const pickPost = (id: string) => {
    const rec = getPosts().find((p) => p.id === id);
    setField("postId", id);
    setField("title", rec?.title ?? "");
    setField("excerpt", rec?.excerpt ?? "");
    setField("imageUrl", rec?.imageUrl ?? "");
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    for (const key of REQUIRED_FIELDS[kind]) {
      if (!str(key).trim()) errs[key] = "This field is required";
    }
    if (kind === "hero-banners") {
      if (str("buttonAction") === "external") {
        if (!str("destinationUrl").trim()) errs.destinationUrl = "Enter the destination URL";
      } else if (!str("destinationId")) {
        errs.destinationId = "Choose a destination";
      }
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
      case "hero-banners":
        item = {
          id,
          title: str("title"),
          subtitle: str("subtitle"),
          imageUrl: str("imageUrl"),
          buttonText: str("buttonText"),
          buttonAction: str("buttonAction") as HeroBanner["buttonAction"],
          destinationId: str("destinationId"),
          destinationUrl: str("destinationUrl"),
          startDate: str("startDate"),
          endDate: str("endDate"),
          status: str("status") as HeroBanner["status"],
          createdAt: now,
          updatedAt: now,
        } as HeroBanner;
        if (editingId) await actions.updateHeroBanner(id, item as HeroBanner);
        else await actions.addHeroBanner(item as HeroBanner);
        break;
      case "featured-categories":
        item = {
          id,
          categoryId: str("categoryId"),
          categoryName: str("categoryName"),
          imageUrl: str("imageUrl"),
          position: num("position"),
          status: str("status") as FeaturedCategory["status"],
          createdAt: now,
          updatedAt: now,
        } as FeaturedCategory;
        if (editingId) await actions.updateFeaturedCategory(id, item as FeaturedCategory);
        else await actions.addFeaturedCategory(item as FeaturedCategory);
        break;
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
      case "featured-posts":
        item = {
          id,
          postId: str("postId"),
          title: str("title"),
          excerpt: str("excerpt"),
          imageUrl: str("imageUrl"),
          position: num("position"),
          isPinned: Boolean(form.isPinned),
          status: str("status") as FeaturedPost["status"],
          startDate: str("startDate"),
          endDate: str("endDate"),
          createdAt: now,
          updatedAt: now,
        } as FeaturedPost;
        if (editingId) await actions.updateFeaturedPost(id, item as FeaturedPost);
        else await actions.addFeaturedPost(item as FeaturedPost);
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
          {kind === "hero-banners" && (
            <>
              <Field label="Title" error={errors.title} fieldKey="title">
                <Input value={str("title")} onChange={(e) => setField("title", e.target.value)} />
              </Field>
              <Field label="Subtitle">
                <Input value={str("subtitle")} onChange={(e) => setField("subtitle", e.target.value)} />
              </Field>
              <Field label="Banner image">
                <ImageUpload value={str("imageUrl")} onChange={(v) => setField("imageUrl", v)} label="banner image" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Button text" error={errors.buttonText} fieldKey="buttonText">
                  <Input value={str("buttonText")} onChange={(e) => setField("buttonText", e.target.value)} />
                </Field>
                <Field label="Button action">
                  <Select
                    options={ACTION_OPTIONS}
                    value={str("buttonAction")}
                    onChange={(e) => {
                      setField("buttonAction", e.target.value);
                      setField("destinationId", "");
                      setField("destinationUrl", "");
                    }}
                  />
                </Field>
              </div>
              {str("buttonAction") === "external" ? (
                <Field label="Destination URL" error={errors.destinationUrl} fieldKey="destinationUrl">
                  <Input value={str("destinationUrl")} onChange={(e) => setField("destinationUrl", e.target.value)} placeholder="https://..." />
                </Field>
              ) : (
                <Field label={`Link to ${ACTION_LABEL[str("buttonAction")]}`} error={errors.destinationId} fieldKey="destinationId">
                  <SearchableSelect
                    options={RECORD_OPTIONS[str("buttonAction")] ?? []}
                    value={str("destinationId")}
                    onChange={(v) => setField("destinationId", v)}
                    placeholder={`Choose a ${ACTION_LABEL[str("buttonAction")]}...`}
                    emptyText="No matching records"
                  />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date">
                  <Input type="date" value={str("startDate")} onChange={(e) => setField("startDate", e.target.value)} />
                </Field>
                <Field label="End date">
                  <Input type="date" value={str("endDate")} onChange={(e) => setField("endDate", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {kind === "featured-categories" && (
            <>
              <Field label="Category" error={errors.categoryName} fieldKey="categoryName">
                <SearchableSelect
                  options={RECORD_OPTIONS.category}
                  value={str("categoryId")}
                  onChange={pickCategory}
                  fallbackLabel={str("categoryName")}
                  placeholder="Search categories..."
                  emptyText="No matching categories"
                />
              </Field>
              <Field label="Category image">
                <ImageUpload
                  value={str("imageUrl")}
                  onChange={(v) => setField("imageUrl", v)}
                  label="category image"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Position">
                  <Input type="number" min={1} value={String(num("position"))} onChange={(e) => setField("position", Number(e.target.value))} />
                </Field>
                <Field label="Status">
                  <Select options={STATUS_OPTIONS[kind]} value={str("status")} onChange={(e) => setField("status", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {kind === "top-sellers" && (
            <>
              <Field label="Seller" error={errors.sellerName} fieldKey="sellerName">
                <SearchableSelect
                  options={RECORD_OPTIONS.seller}
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
                  options={RECORD_OPTIONS.product}
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
                <Field label="Original price ($)">
                  <Input type="number" min={0} step={0.01} value={String(num("originalPrice"))} onChange={(e) => setField("originalPrice", Number(e.target.value))} />
                </Field>
                <Field label="Discounted price ($)">
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

          {kind === "featured-posts" && (
            <>
              <Field label="Post" error={errors.title} fieldKey="title">
                <SearchableSelect
                  options={RECORD_OPTIONS.post}
                  value={str("postId")}
                  onChange={pickPost}
                  fallbackLabel={str("title")}
                  placeholder="Search posts..."
                  emptyText="No matching posts"
                />
              </Field>
              <Field label="Title" error={errors.title}>
                <Input value={str("title")} onChange={(e) => setField("title", e.target.value)} />
              </Field>
              <Field label="Excerpt">
                <Input value={str("excerpt")} onChange={(e) => setField("excerpt", e.target.value)} />
              </Field>
              <Field label="Cover image">
                <RecordPreview src={str("imageUrl")} label="cover image" />
              </Field>
              <Field label="Position">
                <Input type="number" min={1} value={String(num("position"))} onChange={(e) => setField("position", Number(e.target.value))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date">
                  <Input type="date" value={str("startDate")} onChange={(e) => setField("startDate", e.target.value)} />
                </Field>
                <Field label="End date">
                  <Input type="date" value={str("endDate")} onChange={(e) => setField("endDate", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <Select options={STATUS_OPTIONS[kind]} value={str("status")} onChange={(e) => setField("status", e.target.value)} />
                </Field>
                <div className="flex items-end pb-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 ">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#6C3BFF]"
                      checked={Boolean(form.isPinned)}
                      onChange={(e) => setField("isPinned", e.target.checked)}
                    />
                    Pinned
                  </label>
                </div>
              </div>
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