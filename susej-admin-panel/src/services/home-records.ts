// Live record sources for the Home Management pickers. Each getter fetches
// real rows from /api/data and maps them defensively to the picker shapes.
// Results are cached per page-load so repeated opens don't refetch.

import type { FeaturedPostRecord } from "@/types/home-management";

// Minimal picker-row shapes: only the fields the Home Management forms
// actually read. Full admin types (Category, Seller, ...) carry many more
// required fields than a live /api/data row guarantees.
export interface PickerCategory {
  id: string;
  name: string;
  enabled: boolean;
  bannerImage?: string;
  itemCount: number;
}

export interface PickerSeller {
  id: string;
  businessName: string;
  ownerName: string;
  logo?: string;
  email?: string;
  phone?: string;
  status?: string;
}

export interface PickerProduct {
  id: string;
  title: string;
  images: string[];
  price: number;
  category?: string;
  status?: string;
}

type Row = Record<string, unknown>;

const str = (row: Row, ...keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return "";
};

const num = (row: Row, key: string): number => (typeof row[key] === "number" ? (row[key] as number) : 0);

async function fetchRows(resource: string): Promise<Row[]> {
  try {
    const res = await fetch(`/api/data/${resource}`, { cache: "no-store" });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body?.rows) ? (body.rows as Row[]) : [];
  } catch {
    return [];
  }
}

export async function fetchCategories(): Promise<PickerCategory[]> {
  const rows = await fetchRows("categories");
  return rows.map((r) => ({
    id: str(r, "id"),
    name: str(r, "name", "title"),
    enabled: r.enabled !== false,
    bannerImage: str(r, "image", "imageUrl", "bannerImage") || undefined,
    itemCount: num(r, "productCount"),
  }));
}

export async function fetchSellers(): Promise<PickerSeller[]> {
  const rows = await fetchRows("sellers");
  return rows.map((r) => ({
    id: str(r, "id"),
    businessName: str(r, "businessName", "shopName", "name"),
    ownerName: str(r, "ownerName"),
    logo: str(r, "logo", "avatar") || undefined,
    email: str(r, "email") || undefined,
    phone: str(r, "phone") || undefined,
    status: str(r, "status") || undefined,
  }));
}

export async function fetchProducts(): Promise<PickerProduct[]> {
  const rows = await fetchRows("products");
  return rows.map((r) => ({
    id: str(r, "id"),
    title: str(r, "title", "name"),
    images: [str(r, "image", "imageUrl")].filter(Boolean),
    price: num(r, "price"),
    category: str(r, "category") || undefined,
    status: str(r, "status") || undefined,
  }));
}

export async function fetchPosts(): Promise<FeaturedPostRecord[]> {
  const rows = await fetchRows("posts");
  return rows.map((r) => ({
    id: str(r, "id"),
    title: str(r, "title") || str(r, "description").split("\n")[0],
    excerpt: str(r, "excerpt") || str(r, "description").split("\n")[0],
    imageUrl: str(r, "image", "imageUrl"),
    authorName: str(r, "authorName", "author") || undefined,
    publishedAt: str(r, "createdAt", "publishedAt") || undefined,
  }));
}
