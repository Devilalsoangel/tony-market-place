"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientMockRows } from "@/lib/client-mock-rows";

export type DbResource =
  | "users"
  | "sellers"
  | "categories"
  | "products"
  | "orders"
  | "communities"
  | "reviews"
  | "transactions"
  | "ledger"
  | "gateway-logs"
  | "shipments"
  | "carriers"
  | "delivery-zones"
  | "tickets"
  | "audit-logs"
  | "notification-templates"
  | "notification-history"
  | "reported-products"
  | "reported-messages"
  | "reported-comments"
  | "reported-users"
  | "messages"
  | "posts"
  | "blocked"
  | "address-book"
  | "payment-methods"
  | "live"
  | "reels"
  | "stories"
  | "hashtags"
  | "bundles"
  | "food-hub"
  | "broadcasts"
  | "bookings"
  | "loyalty"
  | "disputes"
  | "promotions"
  | "commission"
  | "coupons"
  | "revenue-metrics"
  | "hero-banners"
  | "featured-categories"
  | "top-sellers"
  | "hot-deals"
  | "featured-posts"
  | "home-sections"
  | "app-settings"
  | "auctions" | "bundles" | "food-hub" | "loyalty" | "admins" | "refunds" | "withdrawals";

export function useDbResource<T>(resource: DbResource) {
  const [data, setData] = useState<T[] | null>(() => {
    const rows = clientMockRows(resource);
    return rows.length > 0 ? (rows as T[]) : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const resourceRef = useRef(resource);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data/${resourceRef.current}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to load");
      setData(body.rows as T[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}