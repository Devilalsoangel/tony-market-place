import { CATEGORIES } from './theme';

// ─── CATEGORY TREE (17 mains + child sub-categories) ──────────────────────
// Every main category (ids match CATEGORIES[] in theme.ts) carries its own
// child sub-categories. Users can pick children with chips OR type their own
// (see components/CategoryPicker.tsx). The storefront filter rails derive
// from the same tree so sellers and buyers see identical options.
//
// `colors` here are the functional category accents from theme.ts CATEGORIES
// (product/UI accents — not theme tokens by design).

export interface CategoryNode {
  id: string;
  label: string;
  color: string;
  children: string[];
}

export const CATEGORY_TREE: CategoryNode[] = [
  {
    id: 'fashion',
    label: 'Fashion',
    color: '#9b6dff',
    children: [
      'Kurtas & Ethnic', 'Sarees', 'Dresses', 'Top & T-Shirts', 'Jeans & Trousers',
      'Shirts', 'Footwear', 'Bags & Clutches', 'Jewellery & Accessories', 'Kids Fashion',
      'Streetwear', 'Bridal Wear', 'Activewear', 'Innerwear', 'Sale',
    ],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    color: '#4a7dff',
    children: [
      'Mobiles', 'Laptops', 'Tablets', 'Televisions', 'Headphones & Audio',
      'Cameras', 'Smart Watches', 'Gaming', 'Home Appliances', 'Refrigerators',
      'Washing Machines', 'AC & Cooling', 'Accessories', 'Refurbished', 'Repair Services',
    ],
  },
  {
    id: 'realEstate',
    label: 'Real Estate',
    color: '#6b5fef',
    children: [
      '1BHK', '2BHK', '3BHK', 'Villas', 'Plots & Land', 'PG & Hostels',
      'Commercial Space', 'Offices', 'Shops', 'Rentals', 'Ready to Move',
      'Under Construction', 'Resale', 'New Projects', 'Co-living',
    ],
  },
  {
    id: 'automobiles',
    label: 'Automobiles',
    color: '#5d5fef',
    children: [
      'Cars', 'Bikes', 'Scooters', 'SUVs', 'Sedans', 'Hatchbacks',
      'EV', 'Commercial Vehicles', 'Auto Loans & Insurance', 'Spare Parts',
      'Accessories', 'Rentals', 'Driving School', 'Showroom New', 'Resale',
    ],
  },
  {
    id: 'food',
    label: 'Food & Groceries',
    color: '#43d5a5',
    children: [
      'Vegetarian', 'Non-Veg', 'Biryani & Rice', 'Parotta & Breads', 'Tandoor & Grill',
      'South Indian', 'Chinese', 'North Indian', 'Desserts', 'Snacks & Chaats',
      'Beverages', 'Groceries', 'Organic', 'Meat & Seafood', 'Dairy',
    ],
  },
  {
    id: 'beauty',
    label: 'Beauty',
    color: '#d56bf0',
    children: [
      'Salon Services', 'Makeup', 'Skincare', 'Hair Care', 'Nails',
      'Spa & Massage', "Men's Grooming", 'Bridal Packages', 'Beauty Products',
      'Laser & Treatments', 'Tattoo & Piercing', 'Wellness',
    ],
  },
  {
    id: 'fitness',
    label: 'Fitness',
    color: '#ef5d6b',
    children: [
      'Gym Membership', 'Yoga', 'Personal Training', 'Zumba & Dance', 'CrossFit',
      'Sports Coaching', 'Home Workout', 'Nutrition Plans', 'Diet Consultation',
      'Equipment', 'Supplements', 'Recovery & Physio',
    ],
  },
  {
    id: 'education',
    label: 'Education',
    color: '#5fa8ef',
    children: [
      'Tuition', 'Online Courses', 'Coaching', 'Music Classes', 'Dance Classes',
      'Language Classes', 'Test Prep', 'Computer Skills', 'Art & Hobby',
      'School Admissions', 'College Guidance', 'Certifications',
    ],
  },
  {
    id: 'homeServices',
    label: 'Home Services',
    color: '#a08060',
    children: [
      'Cleaning', 'Plumbing', 'Electrical', 'Painting', 'Pest Control',
      'Appliance Repair', 'Carpentry', 'Moving & Packing', 'Pooja & Events',
      'Gardening', 'Waterproofing', 'Deep Cleaning',
    ],
  },
  {
    id: 'art',
    label: 'Art & Crafts',
    color: '#9b6dcc',
    children: [
      'Paintings', 'Handicrafts', 'Digital Art', 'Sculptures', 'Photography',
      'Pottery', 'Custom Art', 'Canvas & Frames', 'Murals', 'Resin Art',
    ],
  },
  {
    id: 'pets',
    label: 'Pets',
    color: '#d5a060',
    children: [
      'Dogs', 'Cats', 'Birds', 'Fish & Aquarium', 'Pet Food', 'Vet Services',
      'Grooming', 'Training', 'Accessories', 'Adoption', 'Pet Boarding',
    ],
  },
  {
    id: 'agriculture',
    label: 'Agriculture',
    color: '#43b56b',
    children: [
      'Fresh Produce', 'Seeds', 'Fertilizers', 'Farm Tools', 'Livestock', 'Poultry',
      'Organic Farming', 'Irrigation', 'Dairy', 'Agri Services', 'Greenhouse',
    ],
  },
  {
    id: 'kids',
    label: 'Kids',
    color: '#efb043',
    children: [
      'Toys', 'Kids Clothing', 'School Supplies', 'Strollers & Prams', 'Baby Care',
      'Books', 'Nursery Furniture', 'Birthday & Party', 'Kids Shoes', 'Learning Toys',
    ],
  },
  {
    id: 'services',
    label: 'Services',
    color: '#50b5a0',
    children: [
      'Printing & Xerox', 'Events & Decor', 'Photography', 'Consultancy', 'Repairs',
      'Travel & Tour', 'Finance & Tax', 'Legal', 'Packing & Moving', 'Courier',
      'Security', 'Franchise',
    ],
  },
  {
    id: 'b2b',
    label: 'B2B & Wholesale',
    color: '#708090',
    children: [
      'Raw Materials', 'Wholesale Lots', 'OEM / ODM', 'Packaging', 'Logistics',
      'Machinery', 'Bulk Orders', 'Exports', 'Textiles', 'Spices & Grains',
      'Chemicals', 'Stationery Bulk',
    ],
  },
  {
    id: 'job',
    label: 'Jobs',
    color: '#5080c0',
    children: [
      'IT & Software', 'Marketing', 'Sales', 'Finance', 'Healthcare', 'Education',
      'Engineering', 'Design & Creative', 'Operations', 'Part-time', 'Internships',
      'Remote', 'Freshers', 'Work from Home',
    ],
  },
  {
    id: 'medical',
    label: 'Medical',
    color: '#40c0a0',
    children: [
      'Clinic', 'Doctor Consultation', 'Diagnostics & Lab', 'Dental', 'Physiotherapy',
      'Pharmacy', 'Home Care', 'Ayurveda', 'Lab Tests', 'Vaccination', 'Ambulance',
      'Mental Health',
    ],
  },
];

// id → node (fast lookup by CATEGORIES[].id)
const BY_ID = new Map(CATEGORY_TREE.map((c) => [c.id, c]));

// label → node (seed posts store labels like 'Food', 'Home Services')
const BY_LABEL = new Map<string, CategoryNode>();
for (const c of CATEGORY_TREE) BY_LABEL.set(c.label.toLowerCase(), c);

// alias → node (theme CATEGORIES chip labels like 'Food', 'B2B' differ from the
// tree labels 'Food & Groceries' / 'B2B & Wholesale' — map every chip label too)
const BY_ALIAS = new Map<string, CategoryNode>();
for (const c of CATEGORIES) {
  const node = BY_ID.get(c.id) ?? BY_LABEL.get(c.label.toLowerCase());
  if (node) BY_ALIAS.set(c.label.toLowerCase(), node);
}

/** Resolve a main category by id OR label (tree label or chip alias). */
export function findMainCategory(input: string | undefined | null): CategoryNode | undefined {
  if (!input) return undefined;
  const trimmed = input.trim().toLowerCase();
  return BY_ID.get(input) ?? BY_LABEL.get(trimmed) ?? BY_ALIAS.get(trimmed);
}

/** Child sub-categories for a main category (by id or label). */
export function getChildCategories(input: string | undefined | null): string[] {
  return findMainCategory(input)?.children ?? [];
}

/**
 * Category used to filter storefront posts. Accepts a child sub-category name
 * or a main id/label and resolves it for post.category matching.
 */
export function resolveCategoryToken(token: string | undefined | null): string | undefined {
  if (!token) return undefined;
  if (BY_ID.has(token)) return token;
  const trimmed = token.trim();
  const main = findMainCategory(trimmed);
  if (main) return main.label;
  return trimmed; // fall back to the raw token (custom sub-category)
}

/**
 * Live type-to-filter search across mains + children.
 * Returns matched main categories plus any matching child strings.
 */
export function searchCategories(query: string): { main: CategoryNode; matchedChildren: string[] }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: { main: CategoryNode; matchedChildren: string[] }[] = [];
  for (const c of CATEGORY_TREE) {
    const mainHit = c.label.toLowerCase().includes(q);
    const matchedChildren = c.children.filter((ch) => ch.toLowerCase().includes(q));
    if (mainHit || matchedChildren.length > 0) {
      hits.push({ main: c, matchedChildren: mainHit ? c.children.slice(0, 6) : matchedChildren.slice(0, 6) });
    }
  }
  return hits.slice(0, 6);
}

/** All child sub-categories across every main (for global suggestion lists). */
export function allChildCategories(): string[] {
  const seen = new Set<string>();
  for (const c of CATEGORY_TREE) for (const ch of c.children) seen.add(ch);
  return [...seen];
}

// Re-export the base list so screens importing this file still see the icons.
export { CATEGORIES };