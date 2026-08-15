import type { User } from '../contexts/AuthContext';

// ─── DEMO ACCOUNT REGISTRY ─────────────────────────────────────────────────
// Used by the Login screen POV switcher: one buyer account + one seller per
// storefront category so the reviewer can jump between buyer POV and each
// seller's dashboard/storefront without re-registering.
//
// Seller usernames MUST match the storefront registry (utils/storefronts.ts)
// so the store view renders the archetype UI for that category.

export interface DemoAccount {
  id: string;
  label: string;
  sub: string;
  categoryLabel: string;
  avatarSeed: string;
  user: User;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'buyer',
    label: 'Buyer (You)',
    sub: 'Feed · Cart · Orders · Chat',
    categoryLabel: 'Shopper',
    avatarSeed: 'pov-buyer',
    user: {
      name: 'Aarav Mehta',
      username: 'user',
      phone: '98765 43210',
      bio: 'Shopping on susej — following my favourite sellers.',
      location: 'Mumbai',
      role: 'buyer',
    },
  },
  {
    id: 'elara_finds',
    label: 'Elara Finds',
    sub: 'Fashion & lifestyle storefront',
    categoryLabel: 'Fashion',
    avatarSeed: 'pov-elara',
    user: {
      name: 'Elara',
      username: 'elara_finds',
      phone: '98200 10001',
      bio: 'Curated sustainable luxury. Weekly drops.',
      location: 'Milan',
      role: 'both',
      isSeller: true,
      businessName: 'Elara Finds',
      category: 'fashion',
      verification: 'approved',
    },
  },
  {
    id: 'spiceroute',
    label: 'Spice Route Kitchen',
    sub: 'Food & groceries storefront',
    categoryLabel: 'Food & Groceries',
    avatarSeed: 'pov-spice',
    user: {
      name: 'Chef Arjun',
      username: 'spiceroute',
      phone: '98200 10002',
      bio: 'Homestyle Indian food cooked fresh to order.',
      location: 'Jaipur',
      role: 'both',
      isSeller: true,
      businessName: 'Spice Route Kitchen',
      category: 'food',
      verification: 'approved',
    },
  },
  {
    id: 'glowsalon',
    label: 'Glow Salon Studio',
    sub: 'Beauty services storefront',
    categoryLabel: 'Beauty',
    avatarSeed: 'pov-glow',
    user: {
      name: 'Mira',
      username: 'glowsalon',
      phone: '98200 10003',
      bio: 'Premium salon with 12+ years of experience.',
      location: 'Delhi NCR',
      role: 'both',
      isSeller: true,
      businessName: 'Glow Salon Studio',
      category: 'beauty',
      verification: 'approved',
    },
  },
  {
    id: 'technova',
    label: 'TechNova Solutions',
    sub: 'Jobs & hiring storefront',
    categoryLabel: 'Jobs',
    avatarSeed: 'pov-technova',
    user: {
      name: 'Neha Kapoor',
      username: 'technova',
      phone: '98200 10004',
      bio: 'Product company building the next generation of commerce apps.',
      location: 'Bengaluru',
      role: 'both',
      isSeller: true,
      businessName: 'TechNova Solutions',
      category: 'job',
      verification: 'approved',
    },
  },
  {
    id: 'homesquare',
    label: 'HomeSquare Realty',
    sub: 'Real estate storefront',
    categoryLabel: 'Real Estate',
    avatarSeed: 'pov-homesquare',
    user: {
      name: 'Rohan',
      username: 'homesquare',
      phone: '98200 10005',
      bio: 'Trusted property consultants since 2012.',
      location: 'Gurugram',
      role: 'both',
      isSeller: true,
      businessName: 'HomeSquare Realty',
      category: 'realEstate',
      verification: 'approved',
    },
  },
  {
    id: 'weaveright',
    label: 'WeaveRight Fabrics',
    sub: 'B2B & wholesale storefront',
    categoryLabel: 'B2B & Wholesale',
    avatarSeed: 'pov-weave',
    user: {
      name: 'Farida',
      username: 'weaveright',
      phone: '98200 10006',
      bio: 'Direct-from-mill fabrics for apparel brands and exporters.',
      location: 'Surat',
      role: 'both',
      isSeller: true,
      businessName: 'WeaveRight Fabrics',
      category: 'b2b',
      verification: 'approved',
    },
  },
  {
    id: 'techvault',
    label: 'TechVault',
    sub: 'Electronics storefront',
    categoryLabel: 'Electronics',
    avatarSeed: 'pov-techvault',
    user: {
      name: 'Vikram',
      username: 'techvault',
      phone: '98200 10007',
      bio: 'Premium electronics and gadgets. Certified refurbished with warranty.',
      location: 'Bengaluru',
      role: 'both',
      isSeller: true,
      businessName: 'TechVault',
      category: 'electronics',
      verification: 'approved',
    },
  },
  {
    id: 'smilecraft',
    label: 'SmileCraft Dental',
    sub: 'Medical services storefront',
    categoryLabel: 'Medical',
    avatarSeed: 'pov-smile',
    user: {
      name: 'Dr. Iyer',
      username: 'smilecraft',
      phone: '98200 10008',
      bio: 'Family dentistry with modern, pain-free treatments.',
      location: 'Chennai',
      role: 'both',
      isSeller: true,
      businessName: 'SmileCraft Dental',
      category: 'medical',
      verification: 'approved',
    },
  },
];

/** The demo account for a username (POV switcher + storefront lookup). */
export function getDemoAccount(username: string | undefined): DemoAccount | undefined {
  if (!username) return undefined;
  return DEMO_ACCOUNTS.find((a) => a.user.username === username);
}