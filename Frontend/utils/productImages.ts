// Unified listing-image / avatar resolution chain used across screens:
// real data first, deterministic seeded fallback last - never position-based cycling.
// (Legacy productImages/sellerAvatars maps removed: their post_001/post_002-era keys
// can never match real post ids, so every lookup was dead weight.)

/**
 * Unified listing-image resolution chain.
 * Prefers the item's own image, then its first carousel entry,
 * then a stable seed-based fallback (same image for the same item everywhere).
 */
export function hasRealImage(source: { image?: unknown; images?: unknown } | null | undefined): boolean {
  const image = (source as any)?.image;
  if (typeof image === 'string' && image.trim().length > 0) return true;
  const images = (source as any)?.images;
  if (Array.isArray(images) && images.some((e: any) => typeof e === 'string' && e.trim().length > 0)) return true;
  return false;
}

export function resolveListingImage(
  source: { image?: unknown; images?: unknown } | null | undefined,
  seedId: string
): { uri: string } {
  const image = source?.image;
  if (typeof image === 'string' && image) return { uri: image };
  const images = source?.images;
  if (Array.isArray(images)) {
    const first = images.find((entry): entry is string => typeof entry === 'string' && !!entry);
    if (first) return { uri: first };
  }
  // No fake photo: imageless listings get a neutral 1px tile (callers render
  // their letter-tile / empty state on top). picsum.seed photos implied real
  // inventory that never existed — a production-integrity violation.
  void seedId;
  return {
    uri: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="100%" height="100%" fill="%23EFECFF"/></svg>',
  };
}

/**
 * Deterministic avatar for any username/id - same identifier always renders
 * the same initials avatar. Initials (not stock faces) so no fake identity
 * is implied; blank-circle problem solved with an honest, stable render.
 */
export function resolveAvatar(usernameOrId: string, bgHex?: string): { uri: string } {
  const seed = encodeURIComponent(usernameOrId || 'user');
  // Optional brand-color background - storefront themes re-skin the initials
  // avatar to the seller's purchased accent (Aug 25).
  const bg = (bgHex || '5d5fef').replace('#', '');
  return { uri: `https://api.dicebear.com/9.x/initials/png?seed=${seed}&backgroundColor=${bg}&fontSize=42` };
}
