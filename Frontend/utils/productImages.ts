// Shared Figma-downloaded image maps, keyed by post id / story id.
// Feed and Product Details both source from here so images never drift.

export const storyAvatars: Record<string, any> = {
  '0': require('../assets/images/img-1-3659.png'), // Your Story
  '1': require('../assets/images/img-1-3667.png'), // elara_mod
  '2': require('../assets/images/img-1-3673.png'), // arc_design
  '3': require('../assets/images/img-1-3679.png'), // lux_gems
  '4': require('../assets/images/img-1-3685.png'), // hype_vault
  '5': require('../assets/images/img-1-3626.png'), // vintage_loft
};

export const productImages: Record<string, any> = {
  'post_001': require('../assets/images/img-1-3734.png'), // Luxe Thread Studio product
  'post_002': require('../assets/images/img-1-3783.png'), // TechVault product
};

export const sellerAvatars: Record<string, any> = {
  'post_001': require('../assets/images/img-1-3692.png'), // Luxe Thread Studio seller
  'post_002': require('../assets/images/img-1-3741.png'), // TechVault seller
};
