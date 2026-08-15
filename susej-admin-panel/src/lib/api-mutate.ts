"use client";

/**
 * Shared mutation helpers for the /api/data/[resource] CRUD layer.
 * Every admin action that changes data goes through these so writes are
 * guaranteed to hit the server (SQLite when live) - no more dummy UIs.
 */

async function request(resource: string, method: "PATCH" | "POST" | "DELETE", body: unknown) {  const res = await fetch(`/api/data/${resource}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let payload: { error?: string } | null = null;
  try {
    payload = await res.json();
  } catch {
    // no body
  }
  if (!res.ok) {
    throw new Error(payload?.error ?? `${method} ${resource} failed (${res.status})`);
  }
  return payload;
}

export async function apiPatch(resource: string, id: string, data: unknown) {
  return request(resource, "PATCH", { id, data });
}

export async function apiPost(resource: string, data: unknown) {
  return request(resource, "POST", data);
}

export async function apiDelete(resource: string, id: string) {
  return request(resource, "DELETE", { id });
}
