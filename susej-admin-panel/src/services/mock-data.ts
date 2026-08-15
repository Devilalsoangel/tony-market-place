import type { KPIData, User, Seller, SellerDocument, AuditAction, SellerAuditLog, Product, Order, RefundRequest, WithdrawalRequest, Community, CommunityMember, CommunityPost, CommunityComment, ReportedContent, ModerationAction, Review, Transaction, GatewayLog, Shipment, Carrier, DeliveryZone, SupportTicket, AuditLog, Category, Coupon, RevenueMetrics, PlanFeature, PlanLimits, AdminUser, LedgerEntry, DeliveryLogEntry, NotificationTemplate, NotificationHistoryItem, PromotionPurchase, CommissionSettings } from "@/types";
import type { FeaturedPostRecord } from "@/types/home-management";

export const mockKPIs: KPIData = {
  totalUsers: 28450,
  newUsersToday: 142,
  onlineUsers: 1832,
  verifiedSellers: 3840,
  pendingSellerRequests: 128,
  totalProducts: 56200,
  pendingProducts: 0,
  communities: 1250,
  ordersToday: 890,
  revenue: 284500,
  pendingReports: 67,
  openSupportTickets: 23,
};

export const mockRevenueData = [
  { month: "Jan", revenue: 185000, orders: 4200 },
  { month: "Feb", revenue: 210000, orders: 4800 },
  { month: "Mar", revenue: 195000, orders: 4500 },
  { month: "Apr", revenue: 240000, orders: 5100 },
  { month: "May", revenue: 225000, orders: 4900 },
  { month: "Jun", revenue: 284500, orders: 5600 },
];

export const mockAdmins: AdminUser[] = [
  { id: "admin_1", name: "Alex Rivera", loginId: "alexrivera", email: "alex@admin.com", password: "Admin@123", role: "super_admin", status: "active", createdAt: "2024-01-01", lastLogin: "2025-07-29T14:30:00Z" },
  { id: "admin_2", name: "Jordan Chen", loginId: "jordanchen", email: "jordan@admin.com", password: "Admin@123", role: "super_admin", status: "active", createdAt: "2024-02-15", lastLogin: "2025-07-28T09:15:00Z" },
  { id: "admin_3", name: "Sam Patel", loginId: "sampatel", email: "sam@admin.com", password: "Admin@123", role: "manager", status: "active", createdAt: "2024-03-10", lastLogin: "2025-07-29T11:00:00Z" },
  { id: "admin_4", name: "Taylor Kim", loginId: "taylorkim", email: "taylor@admin.com", password: "Admin@123", role: "manager", status: "active", createdAt: "2024-04-20", lastLogin: "2025-07-27T16:45:00Z" },
  { id: "admin_5", name: "Morgan Lee", loginId: "morganlee", email: "morgan@admin.com", password: "Admin@123", role: "manager", status: "inactive", createdAt: "2024-05-05", lastLogin: "2025-06-15T10:30:00Z" },
  { id: "admin_6", name: "Casey Johnson", loginId: "caseyjohnson", email: "casey@admin.com", password: "Admin@123", role: "moderator", status: "active", createdAt: "2024-06-01", lastLogin: "2025-07-29T08:00:00Z" },
  { id: "admin_7", name: "Riley Thompson", loginId: "rileythompson", email: "riley@admin.com", password: "Admin@123", role: "moderator", status: "active", createdAt: "2024-07-12", lastLogin: "2025-07-28T13:20:00Z" },
  { id: "admin_8", name: "Avery Garcia", loginId: "averygarcia", email: "avery@admin.com", password: "Admin@123", role: "moderator", status: "inactive", createdAt: "2024-08-25", lastLogin: "2025-05-20T09:00:00Z" },
];

export const mockUsers: User[] = Array.from({ length: 25 }).map((_, i) => ({
  id: `usr_${i + 1}`,
  name: ["Alice Johnson", "Bob Smith", "Charlie Lee", "Diana Ross", "Eve Chen"][i % 5],
  email: ["alice@email.com", "bob@email.com", "charlie@email.com", "diana@email.com", "eve@email.com"][i % 5],
  role: (["buyer", "seller", "admin"] as const)[i % 3],
  status: (["active", "active", "suspended", "active", "banned"] as const)[i % 5],
  joinedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
  verified: i % 3 === 0,
}));

export interface MockReportedUser {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  reason: string;
  reports: number;
  status: "pending" | "reviewed";
  reportDetails: { reporter: string; reason: string; date: string }[];
}

export const mockReportedUsers: MockReportedUser[] = [
  {
    id: "rep_1",
    name: "SpamUser123",
    email: "spamuser123@gmail.com",
    joinedAt: "2026-01-14",
    reason: "Spam",
    reports: 15,
    status: "pending",
    reportDetails: [
      { reporter: "TechStore", reason: "Spam in comments", date: "Jul 28, 2026" },
      { reporter: "FashionHub", reason: "Spam messages", date: "Jul 26, 2026" },
      { reporter: "Anonymous", reason: "Scam links", date: "Jul 20, 2026" },
    ],
  },
  {
    id: "rep_2",
    name: "FakeSeller_99",
    email: "fakeseller99@yahoo.com",
    joinedAt: "2026-02-02",
    reason: "Scam",
    reports: 23,
    status: "pending",
    reportDetails: [
      { reporter: "Buyer_4412", reason: "Never delivered order", date: "Jul 29, 2026" },
      { reporter: "Buyer_9182", reason: "Fake product listing", date: "Jul 27, 2026" },
      { reporter: "HomeGoods", reason: "Counterfeit goods", date: "Jul 22, 2026" },
    ],
  },
  {
    id: "rep_3",
    name: "ToxicBuyer",
    email: "toxicbuyer@outlook.com",
    joinedAt: "2026-03-18",
    reason: "Harassment",
    reports: 8,
    status: "reviewed",
    reportDetails: [
      { reporter: "BookWorld", reason: "Abusive language", date: "Jul 19, 2026" },
      { reporter: "FreshMart", reason: "Threatening messages", date: "Jul 15, 2026" },
    ],
  },
  {
    id: "rep_4",
    name: "CopyCat_Inc",
    email: "copycat.inc@gmail.com",
    joinedAt: "2026-04-05",
    reason: "Copyright",
    reports: 12,
    status: "pending",
    reportDetails: [
      { reporter: "DesignStudio", reason: "Stolen product images", date: "Jul 30, 2026" },
      { reporter: "TechStore", reason: "Copied listings", date: "Jul 28, 2026" },
      { reporter: "BrandGuard", reason: "Trademark infringement", date: "Jul 24, 2026" },
    ],
  },
];

function generateDocuments(): SellerDocument[] {
  return [
    { id: "doc_govt", type: "government_id", label: "Government ID", fileName: "passport.pdf", url: "/mock-docs/id-sample.jpg", uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), verified: true },
    { id: "doc_license", type: "business_license", label: "Business License", fileName: "business_license.pdf", url: "/mock-docs/license-sample.jpg", uploadedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), verified: false },
    { id: "doc_address", type: "address_proof", label: "Address Proof", fileName: "utility_bill.pdf", url: "/mock-docs/address-sample.jpg", uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), verified: true },
    { id: "doc_gst", type: "gst_certificate", label: "GST Certificate", fileName: "gst_cert.pdf", url: "/mock-docs/gst-sample.jpg", uploadedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), verified: false },
    { id: "doc_logo", type: "store_logo", label: "Store Logo", fileName: "logo.png", url: "/mock-docs/logo-sample.jpg", uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), verified: true },
  ];
}

function generateAuditLogs(action: AuditAction, count: number): SellerAuditLog[] {
  const logs: SellerAuditLog[] = [];
  const actions: AuditAction[] = ["approved", "requested_documents", "document_verified", "note_added", "rejected"];
  const notes = [
    "All documents verified and approved",
    "Requested updated business license",
    "Government ID verified successfully",
    "Seller contacted for clarification on address proof",
    "Business license does not match registered name",
    "GST certificate approved after re-verification",
    "Additional documents requested for address proof",
  ];
  for (let i = 0; i < count; i++) {
    logs.push({
      id: `alog_${Math.random().toString(36).slice(2, 8)}`,
      action: actions[i % actions.length],
      adminName: ["Super Admin", "Moderator Jane", "Admin John"][i % 3],
      note: notes[i % notes.length],
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return logs;
}

const sellerNames = [
  { business: "TechStore", owner: "John Doe", email: "john@techstore.com", phone: "+91 98765 43210", address: "42, MG Road, Bengaluru, Karnataka 560001", taxId: "GST-29AABCU9603R1Z1" },
  { business: "FashionHub", owner: "Jane Smith", email: "jane@fashionhub.com", phone: "+91 87654 32109", address: "15, Linking Road, Mumbai, Maharashtra 400052", taxId: "GST-27AABCU9603R1Z2" },
  { business: "HomeGoods", owner: "Mike Lee", email: "mike@homegoods.com", phone: "+91 76543 21098", address: "78, Connaught Place, New Delhi 110001", taxId: "GST-07AABCU9603R1Z3" },
  { business: "FreshMart", owner: "Sarah Kim", email: "sarah@freshmart.com", phone: "+91 65432 10987", address: "203, Park Street, Kolkata, West Bengal 700016", taxId: "GST-19AABCU9603R1Z4" },
  { business: "BookWorld", owner: "Tom Brown", email: "tom@bookworld.com", phone: "+91 54321 09876", address: "55, Commercial Street, Bengaluru, Karnataka 560002", taxId: "GST-29AABCU9603R1Z5" },
];

const sellerAvatarUrls = [
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1633332755192-727a05c4013d?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80",
];

export const mockSellers: Seller[] = Array.from({ length: 15 }).map((_, i) => {
  const info = sellerNames[i % 5];
  const kycStatus: Seller["kycStatus"] = (["pending", "approved", "pending", "rejected", "approved"] as const)[i % 5];
  return {
    id: `sel_${i + 1}`,
    businessName: info.business,
    ownerName: info.owner,
    logo: sellerAvatarUrls[i % sellerAvatarUrls.length],
    email: info.email,
    phone: info.phone,
    address: info.address,
    taxId: info.taxId,
    kycStatus,
    gstStatus: (["pending", "verified", "pending", "unverified", "verified"] as const)[i % 5],
    score: 30 + Math.floor(Math.random() * 70),
    productsCount: Math.floor(Math.random() * 50),
    joinedAt: new Date(Date.now() - (30 + i * 15) * 24 * 60 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - (7 + i % 7) * 24 * 60 * 60 * 1000).toISOString(),
    documents: generateDocuments(),
    auditLogs: generateAuditLogs(kycStatus === "approved" ? "approved" : "requested_documents", 2 + i % 3),
  };
});

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const categoryNames = [
  { id: "cat_1", name: "Fashion", icon: "👗", parentId: null },
  { id: "cat_2", name: "Electronics", icon: "📱", parentId: null },
  { id: "cat_3", name: "Home & Living", icon: "🏠", parentId: null },
  { id: "cat_4", name: "Beauty & Health", icon: "💄", parentId: null },
  { id: "cat_5", name: "Food & Grocery", icon: "🛒", parentId: null },
  { id: "cat_6", name: "Sports & Fitness", icon: "💪", parentId: null },
  { id: "cat_7", name: "Automotive", icon: "🚗", parentId: null },
  { id: "cat_8", name: "Books & Education", icon: "📚", parentId: null },
  { id: "cat_9", name: "Men's Fashion", icon: "👔", parentId: "cat_1" },
  { id: "cat_10", name: "Women's Fashion", icon: "👗", parentId: "cat_1" },
  { id: "cat_11", name: "Kids Fashion", icon: "🧒", parentId: "cat_1" },
  { id: "cat_12", name: "Mobile Phones", icon: "📱", parentId: "cat_2" },
  { id: "cat_13", name: "Laptops & Computers", icon: "💻", parentId: "cat_2" },
  { id: "cat_14", name: "Audio & Headphones", icon: "🎧", parentId: "cat_2" },
  { id: "cat_15", name: "Cameras", icon: "📷", parentId: "cat_2" },
  { id: "cat_16", name: "Furniture", icon: "🪑", parentId: "cat_3" },
  { id: "cat_17", name: "Kitchen & Dining", icon: "🍽️", parentId: "cat_3" },
  { id: "cat_18", name: "Home Decor", icon: "🖼️", parentId: "cat_3" },
  { id: "cat_19", name: "T-Shirts", icon: "👕", parentId: "cat_9" },
  { id: "cat_20", name: "Formal Wear", icon: "🤵", parentId: "cat_9" },
  { id: "cat_21", name: "Smartphones", icon: "📱", parentId: "cat_12" },
  { id: "cat_22", name: "Accessories", icon: "📲", parentId: "cat_12" },
];

const categoryBannerUrls = [
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1542838132-92c53300491e?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
];

export const mockCategories: Category[] = categoryNames.map((c, i) => ({
  id: c.id,
  name: c.name,
  slug: slugify(c.name),
  description: `All ${c.name.toLowerCase()} products in one place.`,
  parentId: c.parentId,
  sortOrder: i + 1,
  icon: c.icon,
  bannerImage: categoryBannerUrls[i % categoryBannerUrls.length],
  status: i < 18 ? "active" : "hidden",
  featured: i < 6,
  productCount: Math.floor(Math.random() * 8000) + 200,
  metaTitle: `Buy ${c.name} Online - SUSEJ Marketplace`,
  metaDescription: `Shop the latest ${c.name.toLowerCase()} collection at SUSEJ. Best prices, authentic products, fast delivery.`,
  createdAt: new Date(Date.now() - (90 + i * 10) * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString(),
}));

const deliveryStatuses: Order["deliveryStatus"][] = ["awaiting_shipment", "packed", "shipped", "out_for_delivery", "delivered", "delivery_failed", "returned", "cancelled"];
const carriers = ["FedEx", "UPS", "DHL", "USPS", "BlueDart"];
const addresses = [
  "123 Main St, New York, NY 10001",
  "456 Oak Ave, Los Angeles, CA 90001",
  "789 Pine Rd, Chicago, IL 60601",
  "321 Elm St, Houston, TX 77001",
  "654 Maple Dr, Phoenix, AZ 85001",
];

const orderProducts = ["Wireless Headphones", "Cotton T-Shirt", "Leather Wallet", "Smart Watch", "Running Shoes", "Backpack", "Desk Lamp"];

const activeDeliverySteps = ["awaiting_shipment", "packed", "shipped", "out_for_delivery", "delivered"];

function buildDeliveryLog(o: Order): DeliveryLogEntry[] {
  const log: DeliveryLogEntry[] = [];
  const base = Date.parse(o.createdAt);
  const atDays = (days: number) => new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  const idx = activeDeliverySteps.indexOf(o.deliveryStatus);
  const reached = (step: string) => idx >= 0 && activeDeliverySteps.indexOf(step) <= idx;
  let id = 1;
  const push = (event: string, timestamp: string, detail: string, location: string) => {
    log.push({ id: `ord_log_${o.id.replace("ORD-", "")}_${id++}`, event, timestamp, detail, location });
  };

  push("Order Placed", atDays(0), `Order received and payment ${o.paymentStatus === "paid" ? "confirmed" : o.paymentStatus}.`, "SUSEJ Marketplace");

  if (reached("packed")) {
    push("Confirmed by Seller", atDays(0.15), `${o.sellerName} accepted the order and started preparing it.`, `${o.sellerName} Storefront`);
    push("Preparing / Packed", atDays(0.25), "Items packed and boxed at the fulfillment center.", "Fulfillment Center");
  }
  if (reached("shipped")) {
    push("Shipped", atDays(1), `Handed to ${o.shippingCarrier}, tracking ${o.trackingNumber}.`, `${o.shippingCarrier} Depot`);
  }
  if (reached("out_for_delivery")) {
    push("Out for Delivery", atDays(2), "Package loaded on final delivery route.", "Regional Distribution Hub");
  }
  if (o.refundStatus === "requested" || o.refundStatus === "approved" || o.refundStatus === "rejected" || o.refundStatus === "refunded") {
    push("Refund Requested", atDays(1.5), `Buyer requested a refund: ${o.refundReason ?? "No reason given"}.`, "SUSEJ Marketplace");
    if (o.refundStatus === "refunded") {
      push("Refund Issued", atDays(2.5), `Refund of ₹${o.amount.toLocaleString()} returned to ${o.buyerName}.`, "SUSEJ Finance");
    }
  }

  if (o.deliveryStatus === "delivered") {
    push("Delivered", o.actualDelivery, `Delivered and signed for by ${o.buyerName}.`, o.shippingAddress);
  } else if (o.deliveryStatus === "delivery_failed") {
    push("Delivery Attempt Failed", o.actualDelivery, "Receiver unavailable on first attempt.", o.shippingAddress);
  } else if (o.deliveryStatus === "returned") {
    push("Returned", o.actualDelivery, `Package returned to ${o.sellerName}.`, `${o.sellerName} Warehouse`);
  } else if (o.deliveryStatus === "cancelled") {
    push("Cancelled", atDays(0.1), "Order cancelled before dispatch.", "SUSEJ Marketplace");
  }

  return log;
}

export const mockOrders: Order[] = Array.from({ length: 20 }).map((_, i) => {
  // Lifecycle mirrors the app: placed -> confirmed -> preparing -> out_for_delivery -> delivered / cancelled.
  const lifecycle = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;
  const status = lifecycle[i % lifecycle.length];
  const ds = status === "delivered" ? "delivered"
    : status === "cancelled" ? "cancelled"
    : status === "placed" || status === "confirmed" ? "awaiting_shipment"
    : status === "preparing" ? "packed"
    : "out_for_delivery";
  const itemCount = (i % 5) + 1;
  const itemsList =
    itemCount <= 3
      ? [{ name: orderProducts[i % orderProducts.length], qty: itemCount }]
      : [
          { name: orderProducts[i % orderProducts.length], qty: itemCount - 1 },
          { name: orderProducts[(i + 1) % orderProducts.length], qty: 1 },
        ];
  const base: Order = {
    id: `ORD-${String(1000 + i).padStart(4, "0")}`,
    buyerName: ["Alice J.", "Bob S.", "Charlie L."][i % 3],
    sellerName: ["TechStore", "FashionHub", "FreshMart"][i % 3],
    amount: (i % 10) * 47 + 30,
    status,
    deliveryStatus: ds,
    items: itemCount,
    itemsList,
    shippingCarrier: carriers[i % carriers.length],
    trackingNumber: `TRK-${String(8000 + i).padStart(4, "0")}`,
    estimatedDelivery: new Date(2026, 6, 2 + (i % 5)).toISOString().split("T")[0],
    actualDelivery: ds === "delivered"
      ? new Date(2026, 6, 1 + (i % 10)).toISOString().split("T")[0]
      : "",
    shippingAddress: addresses[i % addresses.length],
    paymentMethod: (["card", "mobile_money", "bank_transfer", "cod", "wallet", "coupon"] as const)[i % 6],
    paymentStatus: (["paid", "paid", "pending", "paid", "failed", "refunded"] as const)[i % 6],
    createdAt: new Date(2026, 5, 1 + (i % 28), 10, 30).toISOString(),
    deliveryLog: [],
  };
  // Refund sub-state mirrors the app's Order.refund (requested -> approved/rejected -> refunded).
  if (i % 5 === 3 && status !== "cancelled") {
    base.refundStatus = "requested";
    base.refundReason = ["Item not as described", "Received damaged item", "Order never arrived"][i % 3];
  } else if (i % 7 === 5 && status !== "cancelled") {
    base.refundStatus = "refunded";
    base.refundReason = "Buyer cancelled after dispatch";
  } else if (i % 9 === 4 && status !== "cancelled") {
    base.refundStatus = "approved";
    base.refundReason = "Seller agreed to full refund";
  }
  base.deliveryLog = buildDeliveryLog(base);
  return base;
});

// Refund requests mirror the app's Order.refund lifecycle:
// requested -> approved/rejected -> refunded (seller responds first, finance issues).
export const mockRefundRequests: RefundRequest[] = [
  {
    id: "REF-4201",
    orderRef: "ORD-1004",
    buyerName: "Bob S.",
    sellerName: "FashionHub",
    reason: "Received a different shade than listed",
    amount: 89,
    status: "requested",
    requestedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "REF-4202",
    orderRef: "ORD-1007",
    buyerName: "Charlie L.",
    sellerName: "FreshMart",
    reason: "Damaged on delivery",
    amount: 47,
    status: "requested",
    requestedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "REF-4203",
    orderRef: "ORD-1010",
    buyerName: "Alice J.",
    sellerName: "TechStore",
    reason: "Order never arrived",
    amount: 129,
    status: "approved",
    requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "REF-4204",
    orderRef: "ORD-1012",
    buyerName: "Diana R.",
    sellerName: "HomeGoods",
    reason: "Item not as described",
    amount: 320,
    status: "refunded",
    requestedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    respondedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "REF-4205",
    orderRef: "ORD-1015",
    buyerName: "Eve C.",
    sellerName: "FitKart",
    reason: "Changed my mind after purchase",
    amount: 55,
    status: "rejected",
    requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    respondedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "REF-4206",
    orderRef: "ORD-1018",
    buyerName: "Bob S.",
    sellerName: "GreenCrates",
    reason: "Missing items in the box",
    amount: 74,
    status: "requested",
    requestedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

// Payout requests mirror the app's wallet withdrawal flow:
// requested (seller) -> approved/rejected (finance) -> completed (paid out).
export const mockWithdrawalRequests: WithdrawalRequest[] = [
  {
    id: "WDL-1001",
    userName: "TechStore",
    method: "HDFC Bank •••• 4521",
    amount: 24500,
    status: "requested",
    requestedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "WDL-1002",
    userName: "FashionHub",
    method: "ICICI Bank •••• 8803",
    amount: 12850,
    status: "requested",
    requestedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "WDL-1003",
    userName: "HomeGoods",
    method: "SBI •••• 2210",
    amount: 9600,
    status: "requested",
    requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "WDL-1004",
    userName: "ArtisanCrafts",
    method: "Kotak Bank •••• 7812",
    amount: 6400,
    status: "approved",
    requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "WDL-1005",
    userName: "FreshMart",
    method: "HDFC Bank •••• 1194",
    amount: 18200,
    status: "completed",
    requestedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    respondedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "WDL-1006",
    userName: "KicksCorner",
    method: "Axis Bank •••• 6607",
    amount: 4300,
    status: "rejected",
    requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    respondedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const productImageUrls = [
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1627123424574-724758594e93?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1546868871-7041f2a55e12?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
];

export const mockProducts: Product[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `prod_${i + 1}`,
  title: ["Wireless Headphones", "Cotton T-Shirt", "Leather Wallet", "Smart Watch", "Running Shoes"][i % 5],
  images: [productImageUrls[i % productImageUrls.length]],
  price: Math.floor(Math.random() * 500) + 10,
  category: ["Electronics", "Fashion", "Accessories", "Electronics", "Fashion"][i % 5],
  sellerName: ["TechStore", "FashionHub", "HomeGoods"][i % 3],
  status: (["active", "featured", "active", "hidden", "featured"] as const)[i % 5],
  reports: Math.floor(Math.random() * 10),
  createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
}));

function generateMembers(count: number, baseId: string): CommunityMember[] {
  const names = ["Alice Johnson", "Bob Smith", "Charlie Lee", "Diana Ross", "Eve Chen", "Frank Miller", "Grace Kim", "Henry Brown", "Ivy Wang", "Jack Davis"];
  return Array.from({ length: count }).map((_, i) => ({
    id: `${baseId}_mem_${i + 1}`,
    name: names[i % names.length],
    email: `${names[i % names.length].toLowerCase().replace(" ", ".")}@email.com`,
    role: i === 0 ? "admin" : i === 1 ? "moderator" : "member" as const,
    joinedAt: new Date(Date.now() - (30 + i * 15) * 24 * 60 * 60 * 1000).toISOString(),
    status: i === 3 ? "banned" : "active",
  }));
}

function generatePosts(count: number, baseId: string): CommunityPost[] {
  const titles = ["Welcome to our community!", "Weekly discussion thread", "Tips and tricks", "Event announcement", "New feature request", "Community guidelines update", "Share your work", "Question of the week"];
  const authors = ["Alice Johnson", "Bob Smith", "Charlie Lee", "Diana Ross", "Eve Chen"];
  return Array.from({ length: count }).map((_, i) => ({
    id: `${baseId}_post_${i + 1}`,
    title: titles[i % titles.length],
    authorName: authors[i % authors.length],
    createdAt: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000).toISOString(),
    pinned: i === 0,
    hidden: i === count - 1,
    comments: Math.floor(Math.random() * 20),
  }));
}

function generateComments(count: number, baseId: string): CommunityComment[] {
  const texts = ["Great post!", "I agree with this", "Thanks for sharing", "Can you provide more details?", "This is very helpful", "I disagree because...", "When is the next event?", "Love this community!"];
  const authors = ["Alice Johnson", "Bob Smith", "Charlie Lee", "Diana Ross", "Frank Miller"];
  return Array.from({ length: count }).map((_, i) => ({
    id: `${baseId}_cmt_${i + 1}`,
    postTitle: ["Welcome to our community!", "Weekly discussion thread", "Tips and tricks"][i % 3],
    authorName: authors[i % authors.length],
    text: texts[i % texts.length],
    createdAt: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: i === count - 1,
  }));
}

function generateReports(count: number, baseId: string): ReportedContent[] {
  const reasons = ["Spam", "Harassment", "Inappropriate content", "Misinformation", "Hate speech", "Copyright violation"];
  const reporters = ["Moderator Jane", "Admin John", "Charlie Lee", "Frank Miller", "Grace Kim"];
  return Array.from({ length: count }).map((_, i) => ({
    id: `${baseId}_rep_${i + 1}`,
    type: i % 2 === 0 ? "post" : "comment" as const,
    contentId: `${baseId}_${i % 2 === 0 ? "post" : "cmt"}_${i + 1}`,
    reporterName: reporters[i % reporters.length],
    reason: reasons[i % reasons.length],
    preview: `This is a preview of the reported ${i % 2 === 0 ? "post" : "comment"} content...`,
    reportCount: Math.floor(Math.random() * 5) + 1,
    createdAt: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

function generateModLog(count: number, baseId: string): ModerationAction[] {
  const notes = ["Reviewed and dismissed report", "Content hidden after review", "Warning sent to user", "Post removed for violating guidelines", "User banned for repeated violations"];
  const admins = ["Super Admin", "Moderator Jane", "Admin John"];
  return Array.from({ length: count }).map((_, i) => ({
    id: `${baseId}_mod_${i + 1}`,
    action: ["report_dismissed", "post_hidden", "member_banned", "post_hidden", "member_banned"][i % 5] as ModerationAction["action"],
    adminName: admins[i % admins.length],
    note: notes[i % notes.length],
    timestamp: new Date(Date.now() - i * 5 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

const communityNames = [
  { name: "Tech Enthusiasts", owner: "Alice Johnson", desc: "A community for technology lovers and innovators. Discuss the latest gadgets, software, and tech trends." },
  { name: "Fashion Lovers", owner: "Jane Smith", desc: "Share your style, discover fashion trends, and connect with fashion enthusiasts from around the world." },
  { name: "Home Decor", owner: "Mike Lee", desc: "Transform your living space with interior design tips, DIY projects, and home decoration ideas." },
  { name: "Foodies Hub", owner: "Sarah Kim", desc: "For food lovers! Share recipes, restaurant reviews, and culinary experiences." },
  { name: "Book Club", owner: "Tom Brown", desc: "A community for book lovers. Discuss your favorite reads, discover new authors, and join reading challenges." },
];

export const mockCommunities: Community[] = communityNames.map((c, i) => ({
  id: `com_${i + 1}`,
  name: c.name,
  description: c.desc,
  ownerName: c.owner,
  members: 1500 + Math.floor(Math.random() * 8500),
  posts: 50 + Math.floor(Math.random() * 450),
  type: i % 2 === 0 ? "public" : "private" as const,
  status: (["active", "active", "suspended", "active", "banned"] as const)[i % 5],
  reports: [0, 2, 8, 0, 4][i],
  postingLocked: i === 4,
  commentsDisabled: i === 2,
  createdAt: new Date(Date.now() - (90 + i * 30) * 24 * 60 * 60 * 1000).toISOString(),
  memberList: generateMembers(6 + i, `com_${i + 1}`),
  postList: generatePosts(4 + i, `com_${i + 1}`),
  commentList: generateComments(3 + i, `com_${i + 1}`),
  reportedList: i % 2 === 0 ? [] : generateReports(2 + i, `com_${i + 1}`),
  moderationLog: generateModLog(3 + i, `com_${i + 1}`),
}));

export const mockReviews: Review[] = Array.from({ length: 15 }).map((_, i) => ({
  id: `rev_${i + 1}`,
  productName: ["Wireless Headphones", "Cotton T-Shirt", "Leather Wallet"][i % 3],
  reviewerName: ["Alice", "Bob", "Charlie", "Diana"][i % 4],
  rating: Math.floor(Math.random() * 5) + 1,
  text: "Great product, very satisfied with the quality!",
  status: (["approved", "pending", "reported"] as const)[i % 3],
  sellerRating: Math.floor(Math.random() * 5) + 1,
  buyerRating: Math.floor(Math.random() * 5) + 1,
}));

const txnUsers = ["Alice J.", "Bob S.", "Charlie L.", "Diana R.", "Eve M.", "TechStore", "FashionHub", "FreshMart", "HomeGoods", "BookWorld"];
const paymentMethods: Transaction["method"][] = ["card", "mobile_money", "bank_transfer", "cod", "wallet", "coupon"];
const txnGateways: Record<Transaction["method"], string> = {
  card: "Stripe",
  mobile_money: "M-Pesa",
  bank_transfer: "Bank Transfer",
  cod: "Cash on Delivery",
  wallet: "SUSEJ Wallet",
  coupon: "Coupon",
};

export const mockTransactions: Transaction[] = Array.from({ length: 30 }).map((_, i) => {
  const method = paymentMethods[i % paymentMethods.length];
  return {
    id: `txn_${i + 1}`,
    userName: txnUsers[i % txnUsers.length],
    type: (["payment", "payment", "refund", "withdrawal", "commission", "settlement"] as const)[i % 6],
    amount: (i % 12) * 53 + 20,
    method,
    gateway: txnGateways[method],
    reference: `${method === "mobile_money" ? "MM" : "PAY"}-${String(10000 + i * 37).padStart(6, "0")}`,
    status: (["success", "success", "pending", "failed", "success", "success"] as const)[i % 6],
    createdAt: new Date(2026, 5, 1 + (i % 30)).toISOString(),
  };
});

export const mockLedger: LedgerEntry[] = (() => {
  const entries: LedgerEntry[] = [];
  let n = 0;
  mockOrders.forEach((o, i) => {
    const paid = o.paymentStatus === "paid";
    const failed = o.paymentStatus === "failed";
    entries.push({
      id: `led_${String(++n).padStart(3, "0")}`,
      partyName: o.buyerName,
      partyRole: "buyer",
      direction: "in",
      type: "payment",
      amount: o.amount,
      method: o.paymentMethod,
      status: failed ? "failed" : paid ? "success" : "pending",
      orderId: o.id,
      createdAt: o.createdAt,
    });
    if (paid && i % 3 === 1) {
      entries.push({
        id: `led_${String(++n).padStart(3, "0")}`,
        partyName: o.sellerName,
        partyRole: "seller",
        direction: "in",
        type: "fee",
        amount: Math.round(o.amount * 0.029 * 100) / 100,
        method: o.paymentMethod,
        status: "success",
        orderId: o.id,
        createdAt: new Date(Date.parse(o.createdAt) + 5 * 60 * 1000).toISOString(),
      });
    }
    if (["shipped", "delivered", "out_for_delivery"].includes(o.deliveryStatus) && i % 2 === 0) {
      entries.push({
        id: `led_${String(++n).padStart(3, "0")}`,
        partyName: o.sellerName,
        partyRole: "seller",
        direction: "out",
        type: i % 4 === 0 ? "payout" : "settlement",
        amount: o.amount - (paid ? Math.round(o.amount * 0.029 * 100) / 100 : 0),
        method: "bank_transfer",
        status: i % 5 === 0 ? "pending" : "success",
        orderId: o.id,
        createdAt: new Date(Date.parse(o.createdAt) + 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    if (o.paymentStatus === "refunded") {
      entries.push({
        id: `led_${String(++n).padStart(3, "0")}`,
        partyName: o.buyerName,
        partyRole: "buyer",
        direction: "out",
        type: "refund",
        amount: o.amount,
        method: o.paymentMethod,
        status: "success",
        orderId: o.id,
        createdAt: new Date(Date.parse(o.createdAt) + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  });
  return entries;
})();

export const mockGatewayLogs: GatewayLog[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `gw_${i + 1}`,
  gateway: ["Stripe", "M-Pesa", "Razorpay", "PayPal", "Bank Transfer"][i % 5],
  event: (["charge.succeeded", "charge.failed", "refund.created", "payout.sent", "webhook.received"] as const)[i % 5],
  amount: (i % 9) * 65 + 25,
  status: i % 4 === 0 ? "failed" : "success",
  message: i % 4 === 0
    ? ["Insufficient funds", "Card declined", "Gateway timeout", "Invalid credentials"][i % 4]
    : "Request processed successfully",
  createdAt: new Date(2026, 5, 1 + (i % 14)).toISOString(),
}));

export const mockShipments: Shipment[] = mockOrders
  .filter((o) => ["awaiting_shipment", "packed", "shipped", "out_for_delivery", "delivered", "delivery_failed", "returned"].includes(o.deliveryStatus))
  .slice(0, 14)
  .map((o, i) => ({
    id: `SHIP-${String(2000 + i).padStart(4, "0")}`,
    orderId: o.id,
    buyerName: o.buyerName,
    destination: o.shippingAddress,
    carrier: o.shippingCarrier,
    trackingNumber: o.trackingNumber,
    status: o.deliveryStatus,
    estimatedDelivery: o.estimatedDelivery,
    deliveredAt: o.actualDelivery,
    items: o.items,
  }));

export const mockCarriers: Carrier[] = [
  { id: "car_1", name: "FedEx", rate: 12.5, avgDeliveryDays: 3, onTimeRate: 94.2, shipments: 1240, active: true },
  { id: "car_2", name: "UPS", rate: 10.75, avgDeliveryDays: 3, onTimeRate: 92.8, shipments: 1095, active: true },
  { id: "car_3", name: "DHL", rate: 14.9, avgDeliveryDays: 2, onTimeRate: 96.1, shipments: 862, active: true },
  { id: "car_4", name: "USPS", rate: 7.25, avgDeliveryDays: 5, onTimeRate: 88.4, shipments: 1532, active: true },
  { id: "car_5", name: "BlueDart", rate: 8.9, avgDeliveryDays: 4, onTimeRate: 90.7, shipments: 718, active: false },
];

export const mockDeliveryZones: DeliveryZone[] = [
  { id: "zone_1", name: "Zone 1 - City Center", region: "Downtown", rate: 3.5, eta: "Same day", coverage: 100, active: true },
  { id: "zone_2", name: "Zone 2 - Suburbs", region: "Residential areas", rate: 5.0, eta: "1-2 days", coverage: 92, active: true },
  { id: "zone_3", name: "Zone 3 - Rural", region: "Outlying towns", rate: 8.5, eta: "3-5 days", coverage: 74, active: true },
  { id: "zone_4", name: "Zone 4 - Remote", region: "Far districts", rate: 12.0, eta: "5-7 days", coverage: 51, active: false },
];

export const mockTickets: SupportTicket[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `TKT-${String(100 + i).padStart(3, "0")}`,
  userName: ["Alice J.", "Bob S.", "Charlie L.", "Diana R."][i % 4],
  subject: ["Payment issue", "Product not delivered", "Account suspended", "Refund request"][i % 4],
  priority: (["low", "medium", "high", "urgent"] as const)[i % 4],
  status: (["open", "resolved", "closed"] as const)[i % 3],
  assignee: i % 2 === 0 ? "Support Agent" : undefined,
  createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
}));

export const mockAuditLogs: AuditLog[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `log_${i + 1}`,
  adminName: ["Super Admin", "Moderator Jane", "Admin John"][i % 3],
  action: (["login", "update", "delete", "approve", "create", "reject"] as const)[i % 6],
  entity: ["User", "Product", "Order", "Community", "Review"][i % 5],
  entityId: `#${1000 + i}`,
  details: `Performed ${["login", "update", "delete", "approve", "create", "reject"][i % 6]} on ${["User", "Product", "Order", "Community", "Review"][i % 5]}`,
  ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
}));

export const mockGrowthData = [
  { month: "Jan", users: 18000, sellers: 2200 },
  { month: "Feb", users: 20500, sellers: 2600 },
  { month: "Mar", users: 22200, sellers: 2900 },
  { month: "Apr", users: 24800, sellers: 3300 },
  { month: "May", users: 26500, sellers: 3600 },
  { month: "Jun", users: 28450, sellers: 3840 },
];

export const mockTopCategories = [
  { name: "Fashion", value: 35 },
  { name: "Electronics", value: 25 },
  { name: "Home & Living", value: 15 },
  { name: "Beauty", value: 12 },
  { name: "Food & Grocery", value: 8 },
  { name: "Others", value: 5 },
];

function pf(text: string, order: number): PlanFeature {
  return { id: `pf_${Date.now()}_${order}`, text, order };
}

function makeLimits(products: number | null, images: number | null, communities: number | null, team: number | null, storage: number | null): PlanLimits {
  return { maxProducts: products, maxImages: images, maxCommunities: communities, maxTeamMembers: team, maxStorage: storage };
}

export const mockPromotions: PromotionPurchase[] = [
  { id: "prom_1", kind: "topSeller", packageName: "Top Seller Spotlight - 30 days", amountPaid: 1999, currency: "INR", durationDays: 30, sellerId: "s_1", sellerName: "Velvet & Co", sellerLogo: "", status: "active", isPinned: true, position: 1, startsAt: "2026-08-01", endsAt: "2026-08-31", createdAt: "2026-08-01", views: 128400, clicks: 4310 },
  { id: "prom_2", kind: "topSeller", packageName: "Top Seller Spotlight - 7 days", amountPaid: 599, currency: "INR", durationDays: 7, sellerId: "s_2", sellerName: "Urban Threads", sellerLogo: "", status: "active", isPinned: false, position: 2, startsAt: "2026-08-09", endsAt: "2026-08-16", createdAt: "2026-08-09", views: 42100, clicks: 1890 },
  { id: "prom_3", kind: "hotDeal", packageName: "Hot Deal - 30 days", amountPaid: 1499, currency: "INR", durationDays: 30, sellerId: "s_3", sellerName: "TechNest", productId: "prd_104", productName: "Wireless Earbuds Pro", productImage: "", status: "active", isPinned: true, position: 1, startsAt: "2026-07-25", endsAt: "2026-08-24", createdAt: "2026-07-25", views: 98200, clicks: 5120 },
  { id: "prom_4", kind: "hotDeal", packageName: "Hot Deal - 7 days", amountPaid: 499, currency: "INR", durationDays: 7, sellerId: "s_4", sellerName: "HomeMint", productId: "prd_201", productName: "Ceramic Vase Set", productImage: "", status: "active", isPinned: false, startsAt: "2026-08-11", endsAt: "2026-08-18", createdAt: "2026-08-11", views: 15400, clicks: 860 },
  { id: "prom_5", kind: "featuredPost", packageName: "Boost Post - 30 days", amountPaid: 999, currency: "INR", durationDays: 30, sellerId: "s_5", sellerName: "Gadget Guru", postId: "post_031", postTitle: "iPhone 15 Pro unboxed - mint condition", postImage: "", status: "active", isPinned: false, startsAt: "2026-08-02", endsAt: "2026-09-01", createdAt: "2026-08-02", views: 76300, clicks: 2980 },
  { id: "prom_6", kind: "featuredPost", packageName: "Boost Post - 7 days", amountPaid: 349, currency: "INR", durationDays: 7, sellerId: "s_2", sellerName: "Urban Threads", postId: "post_042", postTitle: "Summer Drop 2026 - streetwear restock", postImage: "", status: "active", isPinned: false, startsAt: "2026-08-12", endsAt: "2026-08-19", createdAt: "2026-08-12", views: 8200, clicks: 410 },
  { id: "prom_7", kind: "topSeller", packageName: "Top Seller Spotlight - 30 days", amountPaid: 1999, currency: "INR", durationDays: 30, sellerId: "s_6", sellerName: "FreshBake", status: "expired", isPinned: false, startsAt: "2026-06-20", endsAt: "2026-07-20", createdAt: "2026-06-20", views: 61200, clicks: 2210 },
  { id: "prom_8", kind: "hotDeal", packageName: "Hot Deal - 7 days", amountPaid: 499, currency: "INR", durationDays: 7, sellerId: "s_7", sellerName: "PetCare Plus", productId: "prd_310", productName: "Organic Dog Food 5kg", status: "expired", isPinned: false, startsAt: "2026-07-28", endsAt: "2026-08-04", createdAt: "2026-07-28", views: 9800, clicks: 520 },
  { id: "prom_9", kind: "featuredPost", packageName: "Boost Post - 7 days", amountPaid: 349, currency: "INR", durationDays: 7, sellerId: "s_8", sellerName: "Luxe Finds", postId: "post_055", postTitle: "Designer handbag - weekend sale", status: "pending_payment", isPinned: false, createdAt: "2026-08-13", views: 0, clicks: 0 },
  { id: "prom_10", kind: "hotDeal", packageName: "Hot Deal - 30 days", amountPaid: 1499, currency: "INR", durationDays: 30, sellerId: "s_9", sellerName: "ElectroWorld", productId: "prd_118", productName: "4K Smart TV 55\"", status: "refunded", isPinned: false, startsAt: "2026-07-01", endsAt: "2026-07-15", createdAt: "2026-07-01", views: 24000, clicks: 1180 },
];

export const mockCommissionSettings: CommissionSettings = {
  commissionRate: 8,
  listingFee: 0,
  payoutFee: 20,
  categoryOverrides: [
    { category: "Fashion", rate: 8 },
    { category: "Electronics", rate: 10 },
    { category: "Automobiles", rate: 6 },
    { category: "Food & Groceries", rate: 5 },
    { category: "Beauty", rate: 8 },
    { category: "Home Services", rate: 12 },
  ],
};

export const mockCoupons: Coupon[] = [
  { id: "c_1", code: "WELCOME20", type: "percentage", value: 20, usageLimit: 500, usedCount: 342, expiresAt: "2025-06-30", status: "active", createdAt: "2024-01-01" },
  { id: "c_2", code: "SELLER50", type: "fixed", value: 50, usageLimit: 200, usedCount: 87, expiresAt: "2025-03-15", status: "active", createdAt: "2024-03-01" },
  { id: "c_3", code: "PREMIUM25", type: "percentage", value: 25, usageLimit: 100, usedCount: 100, expiresAt: "2024-12-31", status: "expired", createdAt: "2024-06-01" },
  { id: "c_4", code: "FLASH30", type: "percentage", value: 30, usageLimit: 300, usedCount: 156, expiresAt: "2025-02-28", status: "active", createdAt: "2024-09-01" },
  { id: "c_5", code: "YEARLY100", type: "fixed", value: 100, usageLimit: 50, usedCount: 12, expiresAt: "2025-12-31", status: "active", createdAt: "2024-11-01" },
  { id: "c_6", code: "OLD10", type: "percentage", value: 10, usageLimit: 1000, usedCount: 892, expiresAt: "2024-06-30", status: "disabled", createdAt: "2023-06-01" },
];

export const mockRevenueMetrics: RevenueMetrics = {
  monthlyRevenue: 42850,
  annualRevenue: 498200,
  activeSubscribers: 8,
  renewalsThisMonth: 3,
  churnRate: 4.2,
  revenueHistory: [
    { month: "Jul", revenue: 28500, subscribers: 18 },
    { month: "Aug", revenue: 31200, subscribers: 20 },
    { month: "Sep", revenue: 33800, subscribers: 22 },
    { month: "Oct", revenue: 36500, subscribers: 24 },
    { month: "Nov", revenue: 39200, subscribers: 26 },
    { month: "Dec", revenue: 42850, subscribers: 28 },
  ],
};

const postImageUrls = [
  "https://images.unsplash.com/photo-1499750310107-5fef28a66643?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
];

export const mockPosts: FeaturedPostRecord[] = [
  { id: "post_1", title: "How to start selling on SUSEJ in 7 days", excerpt: "A step-by-step guide for new sellers: from store setup to your first order.", imageUrl: postImageUrls[0], authorName: "Maria Santos", publishedAt: "2026-07-28T09:00:00Z" },
  { id: "post_2", title: "Top marketing tips that doubled our sellers' sales", excerpt: "Real strategies from our most successful sellers this quarter.", imageUrl: postImageUrls[1], authorName: "James Dela Cruz", publishedAt: "2026-07-25T10:30:00Z" },
  { id: "post_3", title: "The best gadgets to watch out for this season", excerpt: "Electronics editors pick their favorite new releases.", imageUrl: postImageUrls[2], authorName: "Andrea Lim", publishedAt: "2026-07-22T14:00:00Z" },
  { id: "post_4", title: "Seller success story: From garage to 10k orders", excerpt: "How one home-based seller scaled with SUSEJ tools.", imageUrl: postImageUrls[3], authorName: "Maria Santos", publishedAt: "2026-07-19T08:15:00Z" },
  { id: "post_5", title: "Understanding shipping zones and delivery fees", excerpt: "A plain-English guide to what you charge customers for delivery.", imageUrl: postImageUrls[4], authorName: "Rafael Mendoza", publishedAt: "2026-07-15T11:45:00Z" },
  { id: "post_6", title: "Community spotlight: Fashion Week on SUSEJ", excerpt: "Highlights from the community's biggest fashion event yet.", imageUrl: postImageUrls[5], authorName: "Andrea Lim", publishedAt: "2026-07-12T16:20:00Z" },
  { id: "post_7", title: "5 features every store owner should enable", excerpt: "Small settings that make a big difference to your conversion rate.", imageUrl: postImageUrls[0], authorName: "James Dela Cruz", publishedAt: "2026-07-08T09:30:00Z" },
  { id: "post_8", title: "What's new in the SUSEJ app this month", excerpt: "A roundup of product updates from our latest release.", imageUrl: postImageUrls[1], authorName: "Maria Santos", publishedAt: "2026-07-05T13:00:00Z" },
  { id: "post_9", title: "Running your first flash sale: a playbook", excerpt: "Plan, launch, and measure your next promotion step by step.", imageUrl: postImageUrls[2], authorName: "Rafael Mendoza", publishedAt: "2026-07-01T10:00:00Z" },
  { id: "post_10", title: "How buyers find your store: search & discovery", excerpt: "Understand how our recommendation engine surfaces stores.", imageUrl: postImageUrls[3], authorName: "James Dela Cruz", publishedAt: "2026-06-27T15:10:00Z" },
  { id: "post_11", title: "Photography basics for product listings", excerpt: "Simple lighting and angles that make products sell themselves.", imageUrl: postImageUrls[4], authorName: "Andrea Lim", publishedAt: "2026-06-22T12:00:00Z" },
  { id: "post_12", title: "Year in review: 2026 trends from SUSEJ data", excerpt: "What categories grew fastest and what buyers searched most.", imageUrl: postImageUrls[5], authorName: "Maria Santos", publishedAt: "2026-06-18T09:00:00Z" },
];

export const mockNotificationTemplates: NotificationTemplate[] = [
  { id: "welcome", name: "Welcome", channel: "email", subject: "Welcome to SUSEJ, {{name}}!", body: "<h1>Welcome aboard!</h1><p>Hi {{name}},</p><p>We're thrilled to have you join the SUSEJ community. Start exploring products and connect with sellers today.</p><p>The SUSEJ Team</p>", preview: "Welcome email for new users" },
  { id: "seller-approved", name: "Seller Approved", channel: "email", subject: "Your Seller Application is Approved!", body: "<h1>Congratulations!</h1><p>Dear {{name}},</p><p>Your seller application has been approved. You can now start listing products on SUSEJ.</p><p>Happy selling!</p>", preview: "Sent when seller KYC is approved" },
  { id: "seller-rejected", name: "Seller Rejected", channel: "email", subject: "Update on Your Seller Application", body: "<h1>Application Update</h1><p>Dear {{name}},</p><p>After careful review, we are unable to approve your seller application at this time. Please review the feedback and reapply.</p><p>The SUSEJ Team</p>", preview: "Sent when seller KYC is rejected" },
  { id: "order-delivered", name: "Order Delivered", channel: "push", title: "Order Delivered!", body: "Your order #{{orderId}} has been delivered. Rate your experience!", preview: "Push notification for order delivery" },
  { id: "promotion", name: "Promotion", channel: "email", subject: "Exclusive Offer Just for You!", body: "<h1>Special Offer</h1><p>Hi {{name}},</p><p>Enjoy {{discount}}% off on your next purchase. Use code <strong>{{code}}</strong> at checkout.</p><p>Shop now!</p>", preview: "Promotional email with discount code" },
  { id: "password-reset", name: "Password Reset", channel: "email", subject: "Reset Your Password", body: "<h1>Password Reset</h1><p>Hi {{name}},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href='{{link}}'>Reset Password</a></p>", preview: "Password reset email with link" },
  { id: "weekly-newsletter", name: "Weekly Newsletter", channel: "email", subject: "This Week on SUSEJ", body: "<h1>Weekly Roundup</h1><p>Hi {{name}},</p><p>Check out what's new this week on SUSEJ! New products, trending sellers, and exclusive deals waiting for you.</p><p>The SUSEJ Team</p>", preview: "Weekly newsletter template" },
  { id: "flash-sale", name: "Flash Sale Alert", channel: "push", title: "Flash Sale Live!", body: "Hurry! {{discount}}% off on top products. Limited time only!", preview: "Push alert for flash sales" },
  { id: "announcement", name: "Announcement", channel: "banner", body: "{{message}}", preview: "Site-wide announcement banner" },
];

export const mockNotificationHistory: NotificationHistoryItem[] = [
  { id: "n1", channel: "push", title: "Flash Sale Live!", audience: "All Users", status: "sent", sentAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "n2", channel: "email", title: "New Seller Guidelines", audience: "Sellers", status: "sent", sentAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "n3", channel: "banner", title: "Payment Method Update", audience: "Buyers", status: "draft", sentAt: "" },
  { id: "n4", channel: "push", title: "Weekend Sale Reminder", audience: "All Users", status: "scheduled", scheduledFor: new Date(Date.now() + 86400000).toISOString(), sentAt: "" },
  { id: "n5", channel: "email", title: "Welcome New Members", audience: "Buyers", status: "scheduled", scheduledFor: new Date(Date.now() + 172800000).toISOString(), sentAt: "" },
  { id: "n6", channel: "email", title: "Seller Performance Report", audience: "Verified Sellers", status: "sent", sentAt: new Date(Date.now() - 172800000).toISOString() },
  { id: "n7", channel: "push", title: "Order Shipped", audience: "Buyers", status: "sent", sentAt: new Date(Date.now() - 259200000).toISOString() },
  { id: "n8", channel: "banner", title: "Maintenance Notice", audience: "All Users", status: "draft", sentAt: "" },
];

export interface ReportedProductRow {
  id: string;
  productId: string;
  title: string;
  sellerName: string;
  reason: string;
  reporter: string;
  reportCount: number;
  createdAt: string;
}

export const mockReportedProducts: ReportedProductRow[] = mockProducts
  .filter((p) => p.reports > 0)
  .map((p, i) => ({
    id: `rprod_${i + 1}`,
    productId: p.id,
    title: p.title,
    sellerName: p.sellerName,
    reason: ["Counterfeit item", "Stolen images", "Misleading description", "Prohibited item", "Price gouging"][i % 5],
    reporter: ["Buyer_4412", "BrandGuard", "DesignStudio", "Buyer_9182", "TechStore"][i % 5],
    reportCount: p.reports,
    createdAt: new Date(Date.now() - i * 9 * 60 * 60 * 1000).toISOString(),
  }));

export interface ReportedMessageRow {
  id: string;
  threadId: string;
  participants: string;
  preview: string;
  reason: string;
  severity: "low" | "medium" | "high";
  reportCount: number;
  createdAt: string;
}

export const mockReportedMessages: ReportedMessageRow[] = [
  { id: "rmsg_1", threadId: "CHAT-1042", participants: "Buyer_4412 → TechStore", preview: "Send me your bank details and I'll pay directly...", reason: "Off-platform payment", severity: "high", reportCount: 3, createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
  { id: "rmsg_2", threadId: "CHAT-1038", participants: "FakeSeller_99 → Buyer_9182", preview: "50% advance required before dispatch...", reason: "Scam / advance fraud", severity: "high", reportCount: 5, createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
  { id: "rmsg_3", threadId: "CHAT-1011", participants: "ToxicBuyer → BookWorld", preview: "You are a thief, I will ruin your store...", reason: "Harassment", severity: "medium", reportCount: 2, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "rmsg_4", threadId: "CHAT-0998", participants: "SpamUser123 → multiple", preview: "Buy followers 10k for ₹99, DM me...", reason: "Spam", severity: "medium", reportCount: 7, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "rmsg_5", threadId: "CHAT-0955", participants: "CopyCat_Inc → DesignStudio", preview: "Send the raw PSD so I can check the quality...", reason: "IP theft attempt", severity: "low", reportCount: 1, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
];

export interface ReportedCommentRow {
  id: string;
  commentId: string;
  postTitle: string;
  authorName: string;
  text: string;
  reason: string;
  reportCount: number;
  createdAt: string;
}

export const mockReportedComments: ReportedCommentRow[] = [
  { id: "rcmt_1", commentId: "cmt_221", postTitle: "Weekly discussion thread", authorName: "SpamUser123", text: "Cheap branded shoes, DM for price...", reason: "Spam", reportCount: 4, createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
  { id: "rcmt_2", commentId: "cmt_218", postTitle: "Welcome to our community!", authorName: "ToxicBuyer", text: "This community is full of scammers.", reason: "Harassment", reportCount: 2, createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() },
  { id: "rcmt_3", commentId: "cmt_209", postTitle: "Event announcement", authorName: "FakeSeller_99", text: "Only ₹500 to promote your product here...", reason: "Misleading", reportCount: 3, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "rcmt_4", commentId: "cmt_201", postTitle: "Community guidelines update", authorName: "Anonymous", text: "This guideline is stupid, who cares...", reason: "Hate speech", reportCount: 6, createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
];

export interface MockFeedPost {
  id: string;
  title: string;
  authorName: string;
  type: "post" | "reel" | "story";
  status: "published" | "flagged" | "removed" | "pending";
  likes: number;
  comments: number;
  createdAt: string;
}

export const mockFeedPosts: MockFeedPost[] = [
  { id: "post_101", title: "New season saree collection 🧵", authorName: "FashionHub", type: "post", status: "published", likes: 842, comments: 56, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: "post_102", title: "Unboxing the new wireless earbuds", authorName: "TechStore", type: "reel", status: "published", likes: 1230, comments: 98, createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  { id: "post_103", title: "Fresh organic vegetables, farm direct", authorName: "FreshMart", type: "post", status: "flagged", likes: 210, comments: 34, createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString() },
  { id: "post_104", title: "DIY home decor ideas for small spaces", authorName: "HomeGoods", type: "story", status: "published", likes: 456, comments: 41, createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
  { id: "post_105", title: "50% off clearance this weekend", authorName: "BookWorld", type: "post", status: "pending", likes: 0, comments: 0, createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() },
  { id: "post_106", title: "Counterfeit warning: fake luxury bags", authorName: "BrandGuard", type: "post", status: "flagged", likes: 98, comments: 67, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "post_107", title: "Customer haul: winter jackets review", authorName: "Buyer_4412", type: "reel", status: "published", likes: 315, comments: 22, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "post_108", title: "Spam: buy followers cheap!!", authorName: "SpamUser123", type: "post", status: "removed", likes: 2, comments: 1, createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
];

export interface MockBlockedUser {
  id: string;
  userName: string;
  email: string;
  reason: string;
  bannedBy: string;
  bannedAt: string;
  kind: "blocked" | "banned";
}

export const mockBlockedUsers: MockBlockedUser[] = [
  { id: "blk_1", userName: "SpamUser123", email: "spamuser123@gmail.com", reason: "Spam in comments and DMs", bannedBy: "Moderator Jane", bannedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), kind: "banned" },
  { id: "blk_2", userName: "FakeSeller_99", email: "fakeseller99@yahoo.com", reason: "Scam / advance-fee fraud", bannedBy: "Super Admin", bannedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), kind: "banned" },
  { id: "blk_3", userName: "ToxicBuyer", email: "toxicbuyer@outlook.com", reason: "Harassment of sellers", bannedBy: "Admin John", bannedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), kind: "blocked" },
  { id: "blk_4", userName: "CopyCat_Inc", email: "copycat.inc@gmail.com", reason: "Copyright infringement", bannedBy: "Super Admin", bannedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), kind: "banned" },
  { id: "blk_5", userName: "PriceGouger", email: "gouger@mail.com", reason: "Price manipulation", bannedBy: "Moderator Jane", bannedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), kind: "blocked" },
];

export interface MockAddressBookEntry {
  id: string;
  userName: string;
  label: string;
  address: string;
  city: string;
  phone: string;
  isDefault: boolean;
}

export const mockAddressBook: MockAddressBookEntry[] = [
  { id: "addr_1", userName: "Alice Johnson", label: "Home", address: "42, MG Road, Indiranagar", city: "Bengaluru", phone: "+91 98765 43210", isDefault: true },
  { id: "addr_2", userName: "Alice Johnson", label: "Office", address: "Level 4, Prestige Towers, Residency Road", city: "Bengaluru", phone: "+91 98765 43210", isDefault: false },
  { id: "addr_3", userName: "Bob Smith", label: "Home", address: "15, Linking Road, Bandra West", city: "Mumbai", phone: "+91 87654 32109", isDefault: true },
  { id: "addr_4", userName: "Charlie Lee", label: "Home", address: "78, Connaught Place", city: "New Delhi", phone: "+91 76543 21098", isDefault: true },
  { id: "addr_5", userName: "Charlie Lee", label: "Warehouse", address: "B-14, Okhla Industrial Estate", city: "New Delhi", phone: "+91 76543 21098", isDefault: false },
];

export interface MockPaymentMethod {
  id: string;
  userName: string;
  type: "card" | "upi" | "wallet" | "bank" | "cod";
  brand: string;
  last4: string;
  status: "active" | "expired" | "disabled";
  addedAt: string;
}

export const mockPaymentMethods: MockPaymentMethod[] = [
  { id: "pm_1", userName: "Alice Johnson", type: "card", brand: "Visa", last4: "4242", status: "active", addedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "pm_2", userName: "Alice Johnson", type: "upi", brand: "GPay", last4: "alice@okhdfc", status: "active", addedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "pm_3", userName: "Bob Smith", type: "wallet", brand: "SUSEJ Wallet", last4: "•••• 8802", status: "active", addedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "pm_4", userName: "TechStore", type: "bank", brand: "HDFC Bank", last4: "•••• 5567", status: "active", addedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "pm_5", userName: "Charlie Lee", type: "card", brand: "Mastercard", last4: "8801", status: "expired", addedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString() },
];

export interface MockLiveStream {
  id: string;
  title: string;
  hostName: string;
  viewers: number;
  status: "live" | "ended" | "scheduled";
  startedAt: string;
}

export const mockLiveStreams: MockLiveStream[] = [
  { id: "live_1", title: "Live: New collection launch", hostName: "FashionHub", viewers: 1243, status: "live", startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
  { id: "live_2", title: "Cooking demo: 5-min recipes", hostName: "FreshMart", viewers: 876, status: "live", startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: "live_3", title: "Tech Q&A with our engineers", hostName: "TechStore", viewers: 0, status: "scheduled", startedAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString() },
  { id: "live_4", title: "Auction watch party: vintage bikes", hostName: "AutoBazaar", viewers: 0, status: "ended", startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
];

export interface MockReel {
  id: string;
  title: string;
  creatorName: string;
  views: number;
  likes: number;
  status: "published" | "flagged";
  createdAt: string;
}

export const mockReels: MockReel[] = [
  { id: "reel_1", title: "30-second store tour", creatorName: "FashionHub", views: 15200, likes: 1240, status: "published", createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
  { id: "reel_2", title: "How we pack your orders", creatorName: "TechStore", views: 9800, likes: 740, status: "published", createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "reel_3", title: "Shocking: fake vs real leather", creatorName: "BrandGuard", views: 22100, likes: 1900, status: "flagged", createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "reel_4", title: "Unboxing mystery box", creatorName: "Buyer_4412", views: 5400, likes: 310, status: "published", createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
];

export interface MockStory {
  id: string;
  creatorName: string;
  views: number;
  status: "active" | "expired";
  createdAt: string;
}

export const mockStories: MockStory[] = [
  { id: "story_1", creatorName: "FashionHub", views: 890, status: "active", createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: "story_2", creatorName: "TechStore", views: 1240, status: "active", createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  { id: "story_3", creatorName: "FreshMart", views: 430, status: "expired", createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
  { id: "story_4", creatorName: "HomeGoods", views: 660, status: "active", createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString() },
];

export interface MockHashtag {
  id: string;
  tag: string;
  postsCount: number;
  followers: number;
  trending: boolean;
  status: "active" | "blocked";
}

export const mockHashtags: MockHashtag[] = [
  { id: "tag_1", tag: "#summersale", postsCount: 12400, followers: 45200, trending: true, status: "active" },
  { id: "tag_2", tag: "#handmade", postsCount: 8900, followers: 31800, trending: false, status: "active" },
  { id: "tag_3", tag: "#vintagestyle", postsCount: 3400, followers: 12700, trending: true, status: "active" },
  { id: "tag_4", tag: "#freefollowers", postsCount: 210, followers: 9900, trending: false, status: "blocked" },
  { id: "tag_5", tag: "#organicfood", postsCount: 6700, followers: 24500, trending: false, status: "active" },
];

export interface MockBundle {
  id: string;
  title: string;
  itemsCount: number;
  price: number;
  discount: number;
  sellerName: string;
  status: "active" | "pending" | "ended";
  createdAt: string;
}

export const mockBundles: MockBundle[] = [
  { id: "bundle_1", title: "Starter Kitchen Set", itemsCount: 6, price: 1299, discount: 25, sellerName: "HomeGoods", status: "active", createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "bundle_2", title: "Smart Home Starter Pack", itemsCount: 4, price: 8499, discount: 18, sellerName: "TechStore", status: "active", createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "bundle_3", title: "Festive Fashion Combo", itemsCount: 3, price: 1999, discount: 30, sellerName: "FashionHub", status: "pending", createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "bundle_4", title: "Weekly Grocery Box", itemsCount: 12, price: 799, discount: 12, sellerName: "FreshMart", status: "ended", createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
];

export interface MockFoodItem {
  id: string;
  title: string;
  category: string;
  price: number;
  restaurant: string;
  rating: number;
  status: "available" | "out_of_stock" | "pending";
}

export const mockFoodHub: MockFoodItem[] = [
  { id: "food_1", title: "Butter Chicken with Naan", category: "Main Course", price: 349, restaurant: "Spice Route", rating: 4.6, status: "available" },
  { id: "food_2", title: "Farm Fresh Salad Bowl", category: "Healthy", price: 199, restaurant: "Green Bowl", rating: 4.3, status: "available" },
  { id: "food_3", title: "Artisan Sourdough Loaf", category: "Bakery", price: 120, restaurant: "Bread & Butter", rating: 4.8, status: "out_of_stock" },
  { id: "food_4", title: "Paneer Tikka Platter", category: "Main Course", price: 299, restaurant: "Punjab Grill", rating: 4.4, status: "pending" },
];

export interface MockBroadcast {
  id: string;
  title: string;
  hostName: string;
  listeners: number;
  status: "live" | "scheduled" | "ended";
  scheduledAt: string;
}

export const mockBroadcasts: MockBroadcast[] = [
  { id: "bcast_1", title: "Flash sale announcement", hostName: "SUSEJ Team", listeners: 3450, status: "live", scheduledAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { id: "bcast_2", title: "Seller onboarding webinar", hostName: "SUSEJ Team", listeners: 0, status: "scheduled", scheduledAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() },
  { id: "bcast_3", title: "Community town hall", hostName: "Moderator Jane", listeners: 0, status: "ended", scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
];

export interface MockBooking {
  id: string;
  serviceName: string;
  customerName: string;
  sellerName: string;
  date: string;
  time: string;
  price: number;
  status: "confirmed" | "placed" | "cancelled" | "completed";
}

export const mockBookings: MockBooking[] = [
  { id: "bk_1", serviceName: "Home Cleaning Pro", customerName: "Alice Johnson", sellerName: "CleanSweep", date: "2026-08-13", time: "14:00", price: 85, status: "confirmed" },
  { id: "bk_2", serviceName: "Personal Trainer Session", customerName: "Bob Smith", sellerName: "FitForge", date: "2026-08-14", time: "09:00", price: 40, status: "placed" },
  { id: "bk_3", serviceName: "Car Detailing", customerName: "Charlie Lee", sellerName: "AutoShine", date: "2026-08-14", time: "16:30", price: 120, status: "confirmed" },
  { id: "bk_4", serviceName: "Photography Shoot", customerName: "Diana Ross", sellerName: "LensCraft", date: "2026-08-12", time: "11:00", price: 250, status: "cancelled" },
  { id: "bk_5", serviceName: "AC Repair Visit", customerName: "Eve Chen", sellerName: "CoolAir", date: "2026-08-11", time: "10:30", price: 60, status: "completed" },
];

export interface MockLoyaltyUser {
  id: string;
  userName: string;
  points: number;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  referrals: number;
  rewardsRedeemed: number;
  joinedAt: string;
}

export const mockLoyaltyUsers: MockLoyaltyUser[] = [
  { id: "loy_1", userName: "Alice Johnson", points: 2450, tier: "Gold", referrals: 12, rewardsRedeemed: 4, joinedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "loy_2", userName: "Bob Smith", points: 980, tier: "Silver", referrals: 5, rewardsRedeemed: 2, joinedAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "loy_3", userName: "Charlie Lee", points: 5310, tier: "Platinum", referrals: 28, rewardsRedeemed: 9, joinedAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "loy_4", userName: "Diana Ross", points: 320, tier: "Bronze", referrals: 1, rewardsRedeemed: 0, joinedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() },
];

export interface MockDispute {
  id: string;
  orderId: string;
  buyerName: string;
  sellerName: string;
  reason: string;
  amount: number;
  status: "open" | "under_review" | "resolved";
  raisedAt: string;
  outcome?: "full_refund" | "release_seller" | "split_50_50";
  note?: string;
  resolvedAt?: string;
}

export const mockDisputes: MockDispute[] = [
  { id: "dsp_1", orderId: "ORD-1001", buyerName: "Alice J.", sellerName: "TechStore", reason: "Item not as described", amount: 129, status: "open", raisedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() },
  { id: "dsp_2", orderId: "ORD-1004", buyerName: "Bob S.", sellerName: "FashionHub", reason: "Never received order", amount: 89, status: "under_review", raisedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "dsp_3", orderId: "ORD-1007", buyerName: "Charlie L.", sellerName: "FreshMart", reason: "Damaged on delivery", amount: 47, status: "open", raisedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "dsp_4", orderId: "ORD-1012", buyerName: "Diana R.", sellerName: "HomeGoods", reason: "Refund not processed", amount: 320, status: "resolved", raisedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
];

export interface MockAuction {
  id: string;
  title: string;
  status: "live" | "upcoming" | "ended";
  currentBid: number;
  endsAt: string;
  bids: number;
  sellerName: string;
  sellerUsername: string;
}

export const mockAuctionRows: MockAuction[] = [
  { id: "auc_1", title: "Vintage Rolex Submariner 16610", status: "live", currentBid: 245000, endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), bids: 18, sellerName: "LuxuryFinds", sellerUsername: "luxuryfinds" },
  { id: "auc_2", title: "Sony A7 III Mirrorless Camera", status: "live", currentBid: 68000, endsAt: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(), bids: 23, sellerName: "TechStore", sellerUsername: "techvault_in" },
  { id: "auc_3", title: "Royal Enfield Classic 350 (2021)", status: "upcoming", currentBid: 142000, endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), bids: 11, sellerName: "AutoBazaar", sellerUsername: "autobazaar" },
  { id: "auc_4", title: "Hand-painted Warli Art Canvas", status: "live", currentBid: 8500, endsAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), bids: 7, sellerName: "ArtisanCrafts", sellerUsername: "artisancrafts" },
  { id: "auc_5", title: "iPhone 15 Pro Max 256GB", status: "live", currentBid: 98000, endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), bids: 31, sellerName: "GadgetZone", sellerUsername: "gadgetzone" },
  { id: "auc_6", title: "Limited Edition Sneakers (Nike x Off-White)", status: "ended", currentBid: 42000, endsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), bids: 44, sellerName: "KicksCorner", sellerUsername: "kickscorner" },
];
