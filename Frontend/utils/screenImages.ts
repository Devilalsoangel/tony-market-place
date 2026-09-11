// Real Figma image registry — full-quality downloads from Figma file ZaRKwIZFnGxM4kVAZgOWwd
// Every key maps to a genuine Figma asset (screens/ subfolders), NOT picsum placeholders.
// Position-cycled stock imagery was removed - real records resolve via
// resolveListingImage / resolveAvatar in utils/productImages.ts instead.

// Food & Groceries Hub (1:421) — hero, featured banners, popular items, tall card
export const foodHubImages = {
  hero: require('../assets/images/screens/food-hub/img-1-457.png'), // 350x192
  featured: [require('../assets/images/screens/food-hub/img-1-479.png'), require('../assets/images/screens/food-hub/img-1-498.png')], // 288x176 x2
  popular: [
    require('../assets/images/screens/food-hub/img-1-525.png'),
    require('../assets/images/screens/food-hub/img-1-539.png'),
    require('../assets/images/screens/food-hub/img-1-553.png'),
    require('../assets/images/screens/food-hub/img-1-567.png'),
  ], // 169x169 x4
  tall: require('../assets/images/screens/food-hub/img-1-584.png'), // 229x400
  bento: [require('../assets/images/screens/food-hub/img-1-591.png'), require('../assets/images/screens/food-hub/img-1-594.png')], // 109x194 x2
};

// Edit Profile (1:622)
export const editProfileImages = {
  avatar: require('../assets/images/screens/misc-a/img-1-636.png'), // 88x88
  cover: require('../assets/images/screens/misc-a/img-1-701.png'), // 350x128
};

// Rate & Review Seller (1:905) — single static fallbacks (not position-cycled)
export const rateReviewImages = {
  product: require('../assets/images/screens/misc-a/img-1-924.png'), // 64x64
  avatar: require('../assets/images/screens/misc-a/img-1-968.png'), // 80x80
};

// Notifications (1:993) — also used as real avatar choices in onboarding profile-setup
export const notificationImages = [
  require('../assets/images/screens/misc-a/img-1-1048.png'), // 64x64
  require('../assets/images/screens/misc-a/img-1-1053.png'), // 48x48
  require('../assets/images/screens/misc-a/img-1-1082.png'), // 48x48
];

// Saved Collections (1:1102) — cover option in create-post gallery picker
export const savedCollectionImages = [
  require('../assets/images/screens/saved/img-1-1173.png'),
  require('../assets/images/screens/saved/img-1-1181.png'),
  require('../assets/images/screens/saved/img-1-1189.png'),
  require('../assets/images/screens/saved/img-1-1197.png'),
];

// Interests Selection (1:1334) — 8 category tiles 169x160
export const interestImages = [
  require('../assets/images/screens/interests/img-1-1369.png'),
  require('../assets/images/screens/interests/img-1-1377.png'),
  require('../assets/images/screens/interests/img-1-1385.png'),
  require('../assets/images/screens/interests/img-1-1393.png'),
  require('../assets/images/screens/interests/img-1-1401.png'),
  require('../assets/images/screens/interests/img-1-1409.png'),
  require('../assets/images/screens/interests/img-1-1417.png'),
  require('../assets/images/screens/interests/img-1-1425.png'),
];

// My Profile (1:1752)
export const profileImages = {
  avatar: require('../assets/images/screens/profile/img-1-1798.png'), // 86x86
  highlights: [
    require('../assets/images/screens/profile/img-1-1839.png'),
    require('../assets/images/screens/profile/img-1-1844.png'),
    require('../assets/images/screens/profile/img-1-1849.png'),
  ], // 56x56 x3
};

// Signup / Login (1:1894) — bento images
export const authImages = [
  require('../assets/images/screens/auth/img-1-1911.png'), // 166x251
  require('../assets/images/screens/auth/img-1-1913.png'), // 170x119
  require('../assets/images/screens/auth/img-1-1915.png'), // 173x119
];

// Welcome Carousel — portrait card images (1352x1692 / 1256x1596)
// NOTE: old img-186-41/77 were 512x279 LANDSCAPE — distorted in portrait card (P0 GPT finding Aug 27)
// Reuse the two good portrait images for all3 slides
export const welcomeImages = [
  require('../assets/images/screens/welcome/img-1-1946.png'), // 1352x1692 portrait
  require('../assets/images/screens/welcome/img-1-1963.png'), // 1256x1596 portrait
  require('../assets/images/screens/welcome/img-1-1946.png'), // reuse portrait for community slide
];

// Category Discovery (1:2198) — 3 tiles 256x320
export const categoryImages = [
  require('../assets/images/screens/categories/img-1-2347.png'),
  require('../assets/images/screens/categories/img-1-2356.png'),
  require('../assets/images/screens/categories/img-1-2365.png'),
];

// Book a Service (1:2368)
export const bookServiceImages = {
  hero: require('../assets/images/screens/book-service/img-1-2385.png'), // 350x263
  avatar: require('../assets/images/screens/book-service/img-1-2491.png'), // 40x40
};

// Seller Profile (1:2765)
export const sellerImages = {
  avatar: require('../assets/images/screens/seller/img-1-2807.png'), // 92x92
  products: [
    require('../assets/images/screens/seller/img-1-2852.png'),
    require('../assets/images/screens/seller/img-1-2862.png'),
    require('../assets/images/screens/seller/img-1-2872.png'),
    require('../assets/images/screens/seller/img-1-2882.png'),
    require('../assets/images/screens/seller/img-1-2892.png'),
    require('../assets/images/screens/seller/img-1-2902.png'),
  ], // 170x169 x6
};

// Track Order (1:2919)
export const trackOrderImages = {
  map: require('../assets/images/screens/track-order/img-1-3015.png'), // 351x256
  product: require('../assets/images/screens/track-order/img-1-3040.png'), // 78x78
};

// Nearby Sellers & Communities (1:3058) — static self-marker avatar only
export const nearbyImages = {
  avatar: require('../assets/images/screens/nearby/img-1-3183.png'), // 52x52
};

// Product Details (1:3211)
export const productDetailImages = {
  gallery: [
    require('../assets/images/screens/product/img-1-3250.png'),
    require('../assets/images/screens/product/img-1-3251.png'),
    require('../assets/images/screens/product/img-1-3252.png'),
  ], // 392x488 x3
  sellerAvatar: require('../assets/images/screens/product/img-1-3272.png'), // 44x44
  similar: [
    require('../assets/images/screens/product/img-1-3308.png'),
    require('../assets/images/screens/product/img-1-3318.png'),
    require('../assets/images/screens/product/img-1-3328.png'),
    require('../assets/images/screens/product/img-1-3338.png'),
  ], // 170x169 x4
};

// Create New Post (1:3346)
export const createPostImages = {
  preview: require('../assets/images/screens/create/img-1-3359.png'), // 393x390
  gallery: [
    require('../assets/images/screens/create/img-1-3377.png'),
    require('../assets/images/screens/create/img-1-3382.png'),
    require('../assets/images/screens/create/img-1-3384.png'),
    require('../assets/images/screens/create/img-1-3386.png'),
  ], // 81x81 / 85x85 x3
};
