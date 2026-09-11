// Demo rows REMOVED (Aug 21): every dashboard table reads the real PostgreSQL
// database via /api/data/[resource]. This module stays as a no-op shim so the
// ~24 pages that still import clientMockRows keep compiling; it always returns
// an empty array, so tables show their loading/empty states until the DB
// responds instead of flashing fabricated rows.
export function clientMockRows(_resource: string): unknown[] {
  return [];
}
