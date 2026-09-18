// Unified listing-image / avatar resolution chain used across screens:
// real data first, deterministic seeded fallback last - never position-based cycling.
// (Legacy productImages/sellerAvatars maps removed: their post_001/post_002-era keys
// can never match real post ids, so every lookup was dead weight.)

/**
 * Buyer-visible listing title (server `title` is indexed truth since the
 * title rollout; legacy rows fall back to the first description line).
 * Seller surfaces MUST use this — description-first naming made sellers
 * search in vain for their own buyer-visible titles.
 */
export function listingTitle(
  post: { title?: unknown; description?: unknown } | null | undefined,
  fallback = 'Untitled listing'
): string {
  const t = typeof post?.title === 'string' ? post.title.trim() : '';
  if (t) return t;
  const d = typeof post?.description === 'string' ? post.description.split('\n')[0].trim() : '';
  return d || fallback;
}

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
  // No fake photo: imageless listings get a transparent 1px tile that RN can
  // actually decode (the old SVG data-URI never decoded on native — a blank
  // lavender box). Callers overlay the item initial for a real empty state.
  void seedId;
  return {
    uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };
}

/**
 * Deterministic initials + background for any username/id — rendered LOCALLY
 * (no network, no third-party PII ping per row, offline-proof). Use
 * <AvatarView> for rendered avatars; resolveAvatar remains for data-shaped
 * positions only (followers lists, hub string) until those migrate too.
 */
const AVATAR_BGS = ['#5d5fef', '#00796b', '#c2185b', '#6a1b9a', '#e65100', '#1565c0', '#2e7d32', '#5d4037'];
export function avatarInitials(name: string): { initials: string; bg: string } {
  const clean = String(name ?? '').trim() || 'S';
  const parts = clean.replace(/^@/, '').split(/[\s_.-]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? 'S') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase().slice(0, 2);
  let h = 0;
  for (let i = 0; i < clean.length; i++) h = (h * 31 + clean.charCodeAt(i)) >>> 0;
  return { initials, bg: AVATAR_BGS[h % AVATAR_BGS.length] };
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
