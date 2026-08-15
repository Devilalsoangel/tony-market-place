/**
 * IMAGE-TO-FILE MAPPING
 * Maps Figma node IDs → local PNG filenames
 * Convention: img-{pageId}-{nodeId}.png
 * 
 * Verified: 122/126 images exist (4 are 149-byte stubs from Figma)
 * Use picsum.photos/$id placeholders for broken images in rebuild
 */

export const IMAGE_MAP: Record<string, string> = {
  // Shopping Cart (1:2)
  '1:16': 'img-1-16.png',

  // Community Chat (1:122)
  '1:201': 'img-1-201.png',
  '1:216': 'img-1-216.png',
  '1:252': 'img-1-252.png',

  // Settings (1:271)
  // (no images)

  // Food & Groceries Hub (1:421)
  // (pending verification)

  // Edit Profile (1:622)
  '1:636': 'img-1-636.png',

  // Seller Dashboard (1:763)
  // (pending verification)

  // Rate & Review (1:905)
  // (pending verification)

  // Notifications (1:993)
  '1:1048': 'img-1-1048.png',
  '1:1053': 'img-1-1053.png',
  '1:1082': 'img-1-1082.png',

  // Saved Collections (1:1102)
  '1:1173': 'img-1-1173.png',
  '1:1181': 'img-1-1181.png',
  '1:1189': 'img-1-1189.png',
  '1:1197': 'img-1-1197.png',

  // Order History (1:1204)
  '1:1257': 'img-1-1257.png',
  '1:1277': 'img-1-1277.png',
  '1:1297': 'img-1-1297.png',
  '1:1317': 'img-1-1317.png',

  // Interests Selection (1:1334)
  // (pending verification)

  // First-time Feed Welcome (1:1432)
  // (pending verification)

  // OTP (1:1547)
  // (pending verification)

  // Location Selection (1:1591)
  // (pending verification)

  // Profile Setup (1:1680)
  // (pending verification)

  // My Profile (1:1752)
  // (pending verification)

  // Splash (1:1862)
  '1:1885': 'img-1-1885.png',

  // Signup/Login (1:1894)
  // (pending verification)

  // Welcome Carousel (1:1935)
  // (pending verification)

  // Vintage Fashion (1:2026)
  // (pending verification)

  // Category Discovery (1:2198)
  '1:2347': 'img-1-2347.png',
  '1:2356': 'img-1-2356.png',
  '1:2365': 'img-1-2365.png', // ⚠️ STUB (149 bytes) — use placeholder

  // Book a Service (1:2368)
  // (pending verification)

  // Become a Seller (1:2514)
  // (pending verification)

  // Communities Hub (1:2589)
  // (pending verification)

  // Seller Profile (1:2765)
  // (pending verification)

  // Track Order (1:2919)
  // (pending verification)

  // Nearby Sellers (1:3058)
  // (pending verification)

  // Product Details (1:3211)
  // (pending verification)

  // Create Post (1:3346)
  // (pending verification)

  // Messages (1:3387)
  // (pending verification)

  // Explore (1:3512)
  // (pending verification)

  // Home Feed (1:3640)
  '1:3734': 'img-1-3734.png',
};

export const BROKEN_IMAGES: Record<string, string> = {
  '1:1526': 'img-1-1526.png', // Stub — needs placeholder
  '1:1963': 'img-1-1963.png', // Stub — needs placeholder
  '1:2365': 'img-1-2365.png', // Stub — needs placeholder
  '1:3252': 'img-1-3252.png', // Stub — needs placeholder
};

export const IMAGE_COUNT = 126;
export const BROKEN_COUNT = 4;
