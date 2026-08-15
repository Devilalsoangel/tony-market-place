import { findMainCategory } from './categories';

// ─── CATEGORY-AWARE FLOW CONFIG ────────────────────────────────────────────
// Every industry has its own buyer/seller dynamic. The archetype drives the
// primary CTA, the detail-screen flow, and the fields shown in the Create Post
// wizard. See docs/CATEGORY-AWARE-UI.md for the design.
//
// Archetypes:
//   goods   → physical product → Buy Now / Add to Cart → cart → checkout
//   food    → food & groceries → Order Now → cart (food_item)
//   service → time-based offer → Book Now → book-service (date/time)
//   job     → employment       → Apply Now → application (NO buy, NO cart)
//   enquire → high-value asset → Enquire → contact seller (no cart)
//   quote   → B2B bulk         → Get Quote → quantity/MOQ request (no cart)

export type FlowArchetype = 'goods' | 'food' | 'service' | 'job' | 'enquire' | 'quote';

export interface CategoryFlowConfig {
  archetype: FlowArchetype;
  primaryCta: string;
  secondaryCta: string;
  priceLabel: string;
  priceSuffix: string;
  buyerRole: string;
  sellerRole: string;
  // extra fields requested in the Create Post wizard for this flow
  extraFields: string[];
}

const GOODS: CategoryFlowConfig = {
  archetype: 'goods',
  primaryCta: 'Buy Now',
  secondaryCta: 'Message Seller',
  priceLabel: 'Price',
  priceSuffix: '',
  buyerRole: 'Shoppers',
  sellerRole: 'Sellers',
  extraFields: ['condition', 'brand'],
};

const FOOD: CategoryFlowConfig = {
  archetype: 'food',
  primaryCta: 'Order Now',
  secondaryCta: 'Message Seller',
  priceLabel: 'Price',
  priceSuffix: '',
  buyerRole: 'Diners',
  sellerRole: 'Restaurants & grocers',
  extraFields: ['delivery'],
};

const SERVICE: CategoryFlowConfig = {
  archetype: 'service',
  primaryCta: 'Book Now',
  secondaryCta: 'Message Seller',
  priceLabel: 'Rate',
  priceSuffix: '/hr',
  buyerRole: 'Customers',
  sellerRole: 'Professionals',
  extraFields: ['duration', 'availability'],
};

const JOB: CategoryFlowConfig = {
  archetype: 'job',
  primaryCta: 'Apply Now',
  secondaryCta: 'Message Employer',
  priceLabel: 'Salary',
  priceSuffix: ' LPA',
  buyerRole: 'Job Seekers',
  sellerRole: 'Employers',
  extraFields: ['jobType', 'experience', 'company', 'salaryRange'],
};

const ENQUIRE: CategoryFlowConfig = {
  archetype: 'enquire',
  primaryCta: 'Enquire',
  secondaryCta: 'Message Seller',
  priceLabel: 'Rent / Price',
  priceSuffix: '/mo',
  buyerRole: 'Buyers & Tenants',
  sellerRole: 'Agents & Owners',
  extraFields: ['listingFor', 'negotiable'],
};

const QUOTE: CategoryFlowConfig = {
  archetype: 'quote',
  primaryCta: 'Get Quote',
  secondaryCta: 'Message Supplier',
  priceLabel: 'Bulk Price',
  priceSuffix: '',
  buyerRole: 'Businesses',
  sellerRole: 'Suppliers & manufacturers',
  extraFields: ['moq', 'leadTime'],
};

// Keyed by CATEGORIES[].id — labels resolved through getFlow()
export const CATEGORY_FLOW: Record<string, CategoryFlowConfig> = {
  fashion: GOODS,
  electronics: GOODS,
  realEstate: {
    ...ENQUIRE,
    primaryCta: 'Enquire',
    secondaryCta: 'Schedule Visit',
    priceSuffix: '/mo',
    buyerRole: 'Buyers & Tenants',
    sellerRole: 'Agents & Owners',
  },
  automobiles: {
    ...ENQUIRE,
    primaryCta: 'Enquire',
    secondaryCta: 'Test Drive',
    priceSuffix: '',
    buyerRole: 'Buyers',
    sellerRole: 'Dealers & Owners',
  },
  food: FOOD,
  beauty: {
    ...SERVICE,
    primaryCta: 'Book Now',
    buyerRole: 'Clients',
    sellerRole: 'Salons & studios',
  },
  fitness: {
    ...SERVICE,
    primaryCta: 'Book Now',
    buyerRole: 'Members',
    sellerRole: 'Trainers & gyms',
  },
  education: {
    ...SERVICE,
    primaryCta: 'Enrol Now',
    priceLabel: 'Course Fee',
    priceSuffix: '',
    buyerRole: 'Learners',
    sellerRole: 'Tutors & institutes',
  },
  homeServices: {
    ...SERVICE,
    primaryCta: 'Book Now',
    buyerRole: 'Homeowners',
    sellerRole: 'Professionals',
  },
  art: GOODS,
  pets: GOODS,
  agriculture: GOODS,
  kids: GOODS,
  services: {
    ...SERVICE,
    buyerRole: 'Customers',
    sellerRole: 'Providers',
  },
  b2b: QUOTE,
  job: JOB,
  medical: {
    ...SERVICE,
    primaryCta: 'Book Appointment',
    priceLabel: 'Consult Fee',
    priceSuffix: '',
    buyerRole: 'Patients',
    sellerRole: 'Clinics & doctors',
  },
};

const GOODS_FLOW: CategoryFlowConfig = GOODS;
const SERVICE_FLOW: CategoryFlowConfig = SERVICE;
const FOOD_FLOW: CategoryFlowConfig = FOOD;

/**
 * Resolve the flow config for a category — accepts CATEGORIES[].id or its label
 * (seed posts store labels like 'Fashion', 'Home Services'). Falls back to goods.
 */
export function getFlow(category: string): CategoryFlowConfig {
  if (!category) return GOODS_FLOW;
  const byId = CATEGORY_FLOW[category];
  if (byId) return byId;
  // Resolve chip labels ('Food', 'B2B') and tree labels ('Food & Groceries',
  // 'B2B & Wholesale') through the shared category resolver.
  const main = findMainCategory(category);
  if (main) return CATEGORY_FLOW[main.id] ?? GOODS_FLOW;
  return GOODS_FLOW;
}

/**
 * Resolve the flow for a post. The post-level `type` overrides the category:
 *   'service'   → service flow (Book Now)   — works for any category
 *   'food_item' → food flow (Order Now)
 *   otherwise   → category flow (getFlow)
 */
export function getPostFlow(post: { type?: string; category?: string }): CategoryFlowConfig {
  if (post.type === 'service') return SERVICE_FLOW;
  if (post.type === 'food_item') return FOOD_FLOW;
  return getFlow(post?.category ?? '');
}

/** Render the amount for a flow: ₹1,00,000 + ' LPA' / ' /mo' etc. */
export function formatFlowPrice(amount: number, suffix: string): string {
  const n = new Intl.NumberFormat('en-IN').format(amount);
  return suffix ? `₹${n}${suffix}` : `₹${n}`;
}
