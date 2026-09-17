"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DbResource =
  | "address-book"
  | "admins"
  | "app-settings"
  | "auctions"
  | "audit-logs"
  | "blocked"
  | "bookings"
  | "broadcasts"
  | "bundles"
  | "carriers"
  | "categories"
  | "communities"
  | "commission"
  | "coupons"
  | "delivery-zones"
  | "disputes"
  | "featured-posts"
  | "food-hub"
  | "gateway-logs"
  | "hashtags"
  | "hot-deals"
  | "home-sections"
  | "ledger"
  | "live"
  | "loyalty"
  | "messages"
  | "notification-history"
  | "notification-templates"
  | "orders"
  | "payment-methods"
  | "posts"
  | "products"
  | "promotions"
  | "reported-comments"
  | "reported-messages"
  | "reported-products"
  | "refunds"
  | "reported-users"
  | "revenue-metrics"
  | "reviews"
  | "reels"
  | "sessions"
  | "sellers"
  | "seller-documents"
  | "seller-audit-log"
  | "shipments"
  | "spotlights"
  | "storefront-banners"
  | "stories"
  | "tickets"
  | "top-sellers"
  | "transactions"
  | "users"
  | "withdrawals";

export type DbResourceOptions = {
  q?: string;
  status?: string;
  /** Single-row mode (?id=): detail pages fetch the exact row, never the table. */
  id?: string;
  take?: number;
  skip?: number;
  page?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
};
export function useDbResource<T>(resource: DbResource, opts?: DbResourceOptions) {
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState<number | null>(null);
  const resourceRef = useRef(resource);
  const optsRef = useRef(opts);

  // Keep refs in sync if caller switches resource or query (e.g. tab / filter change).
  useEffect(() => {
    resourceRef.current = resource;
    optsRef.current = opts;
  }, [resource, opts]);

  const buildUrl = useCallback(() => {
    const o = optsRef.current;
    // Scale guard (single choke point): a desk that passes NO pagination opts
    // used to pull the FULL table (server only bounds when take/skip/q/status
    // is present). Default take=100 — the server clamps to 100 max anyway, so
    // this changes nothing under 100 rows and bounds everything above it.
    // Detail pages use { id } (single-row mode, unaffected).
    if (!o || (!o.q && !o.status && !o.id && !o.take && !o.skip && !o.page && !o.orderBy)) {
      return `/api/data/${resourceRef.current}?take=100`;
    }
    const p = new URLSearchParams();
    if (o.q) p.set("q", o.q);
    if (o.status) p.set("status", o.status);
    if (o.id) p.set("id", o.id);
    if (o.take) p.set("take", String(o.take));
    if (o.skip) p.set("skip", String(o.skip));
    if (o.page) p.set("page", String(o.page));
    if (o.orderBy) p.set("orderBy", o.orderBy);
    if (o.orderDir) p.set("orderDir", o.orderDir);
    const qs = p.toString();
    return qs ? `/api/data/${resourceRef.current}?${qs}` : `/api/data/${resourceRef.current}`;
  }, []);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    setLoading(true);
    try {
      const res = await fetch(buildUrl(), { cache: "no-store", credentials: "include", signal: controller.signal });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to load");
      setData(Array.isArray(body.rows) ? (body.rows as T[]) : []);
      if (typeof body.total === "number") setTotal(body.total);
      else setTotal(null);
      setError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setError("Request timed out — database may be unavailable");
      } else {
        setError(e instanceof Error ? e.message : "Failed to load data");
      }
      // Industry-standard: a failed refresh NEVER wipes last-good rows.
      // The table keeps showing stale truth under an error banner instead
      // of flashing an empty state on every transient failure.
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, resource, JSON.stringify(opts ?? null)]);

  // Refetch when the tab/window regains focus so an admin sitting on this
  // page sees mutations (e.g. seller accepted an order) without having to
  // navigate away and back.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  return { data, error, loading, total, refresh };
}