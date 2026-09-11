export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "buyer" | "seller" | "admin";
  status: "active" | "suspended" | "banned";
  joinedAt: string;
  verified: boolean;
  // Seller KYC verdict synced from /api/data/sellers approvals — what the app
  // reads for the blue tick. `verified` above is a legacy boolean, rarely set.
  verification?: "none" | "pending" | "approved" | "rejected";
  username?: string;
  phone?: string;
  // One-shop-one-category: the store's main category (what /api/app/users/
  // [username] serves to the app). Editable here for admins to correct
  // mismatches between the declared shop category and actual listings.
  category?: string;
  isSeller?: boolean;
}

export type DocumentType = "government_id" | "government_id_back" | "business_license" | "address_proof" | "gst_certificate" | "store_logo" | "additional";

export interface SellerDocument {
  id: string;
  type: DocumentType;
  label: string;
  fileName: string;
  url: string;
  uploadedAt: string;
  verified: boolean;
}

export type AuditAction = "approved" | "rejected" | "requested_documents" | "document_verified" | "note_added";

export interface SellerAuditLog {
  id: string;
  action: AuditAction;
  adminName: string;
  note: string;
  timestamp: string;
}

export interface Seller {
  id: string;
  businessName: string;
  ownerName: string;
  logo: string;
  email: string;
  phone: string;
  address: string;
  storeLat?: number | null;
  storeLng?: number | null;
  storeAddress?: string | null;
  // Shop category chosen in the become-a-seller wizard (one per shop).
  category?: string;
  taxId: string;
  // CKYC identity binding (nullable: unknown for legacy rows).
  idType?: string | null;
  idNumber?: string | null;
  nameOnId?: string | null;
  dob?: string | null;
  pan?: string | null;
  bankAccount?: string | null;
  selfieUrl?: string | null;
  kycStatus: "pending" | "approved" | "rejected";
  gstStatus: "pending" | "verified" | "unverified";
  score: number;
  productsCount: number;
  joinedAt: string;
  submittedAt: string;
  documents: SellerDocument[];
  auditLogs: SellerAuditLog[];
}

export interface Product {
  id: string;
  title: string;
  images: string[];
  price: number;
  category: string;
  sellerName: string;
  // Sellers verified via KYC post products directly — no per-product approval queue.
  // Admin moderates live listings post-hoc: hide, feature, delete.
  status: "active" | "hidden" | "featured";
  reports: number;
  warningReason?: string | null;
  createdAt: string;
}

export type DeliveryStatus = "awaiting_shipment" | "packed" | "shipped" | "out_for_delivery" | "delivered" | "delivery_failed" | "returned" | "cancelled";

export type PaymentMethod = "card" | "mobile_money" | "bank_transfer" | "cod" | "wallet" | "coupon";

export type PaymentStatus = "paid" | "pending" | "failed" | "refunded";

export interface DeliveryLogEntry {
  id: string;
  event: string;
  timestamp: string;
  detail: string;
  location: string;
}

export interface Order {
  id: string;
  buyerName: string;
  sellerName: string;
  amount: number;
  status: "placed" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
  deliveryStatus: DeliveryStatus;
  items: number;
  itemsList: { name: string; qty: number }[];
  shippingCarrier: string;
  trackingNumber: string;
  estimatedDelivery: string;
  actualDelivery: string;
  shippingAddress: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  deliveryLog: DeliveryLogEntry[];
  refundStatus?: "requested" | "approved" | "rejected" | "refunded";
  refundReason?: string;
}

export interface RefundRequest {
  id: string;
  orderRef: string;
  buyerName: string;
  sellerName: string;
  reason: string;
  amount: number;
  status: "requested" | "approved" | "rejected" | "refunded";
  requestedAt: string;
  respondedAt?: string;
}

export interface WithdrawalRequest {
  id: string;
  userName: string;
  method: string;
  amount: number;
  status: "requested" | "approved" | "rejected" | "completed";
  requestedAt: string;
  respondedAt?: string;
}

export type CommunityStatus = "active" | "suspended" | "banned";

export interface CommunityMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "moderator" | "member";
  joinedAt: string;
  status: "active" | "banned";
}

export interface CommunityPost {
  id: string;
  title: string;
  authorName: string;
  createdAt: string;
  pinned: boolean;
  hidden: boolean;
  comments: number;
}

export interface CommunityComment {
  id: string;
  postTitle: string;
  authorName: string;
  text: string;
  createdAt: string;
  hidden: boolean;
}

export interface ReportedContent {
  id: string;
  type: "post" | "comment";
  contentId: string;
  reporterName: string;
  reason: string;
  preview: string;
  reportCount: number;
  createdAt: string;
}

export interface ModerationAction {
  id: string;
  action: "suspended" | "unsuspended" | "banned" | "unbanned" | "post_hidden" | "comment_hidden" | "member_removed" | "member_banned" | "member_promoted" | "posting_locked" | "comments_disabled" | "report_dismissed";
  adminName: string;
  note: string;
  timestamp: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  ownerName: string;
  members: number;
  posts: number;
  type: "public" | "private";
  status: CommunityStatus;
  reports: number;
  postingLocked: boolean;
  commentsDisabled: boolean;
  createdAt: string;
  memberList: CommunityMember[];
  postList: CommunityPost[];
  commentList: CommunityComment[];
  reportedList: ReportedContent[];
  moderationLog: ModerationAction[];
}

export interface Review {
  id: string;
  productName: string;
  reviewerName: string;
  rating: number;
  text: string;
  status: "approved" | "pending" | "reported";
  sellerRating?: number;
  buyerRating?: number;
}

export type TransactionType = "payment" | "withdrawal" | "refund" | "commission" | "settlement";
export type TransactionStatus = "success" | "failed" | "pending";

export interface Transaction {
  id: string;
  userName: string;
  type: TransactionType;
  amount: number;
  method: PaymentMethod;
  gateway: string;
  reference: string;
  status: TransactionStatus;
  createdAt: string;
}

export type LedgerDirection = "in" | "out";

export type LedgerType = "payment" | "refund" | "payout" | "settlement" | "withdrawal" | "fee";

export interface LedgerEntry {
  id: string;
  partyName: string;
  partyRole: "buyer" | "seller";
  direction: LedgerDirection;
  type: LedgerType;
  amount: number;
  method: PaymentMethod;
  status: TransactionStatus;
  orderId: string;
  createdAt: string;
}

export interface GatewayLog {
  id: string;
  gateway: string;
  event: string;
  amount: number;
  status: "success" | "failed";
  message: string;
  createdAt: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  buyerName: string;
  destination: string;
  carrier: string;
  trackingNumber: string;
  status: DeliveryStatus;
  estimatedDelivery: string;
  deliveredAt: string;
  items: number;
}

export interface Carrier {
  id: string;
  name: string;
  rate: number;
  avgDeliveryDays: number;
  // null until real shipment data exists — UI renders an em dash, never an invented %.
  onTimeRate: number | null;
  shipments: number;
  active: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  region: string;
  rate: number;
  eta: string;
  coverage: number;
  active: boolean;
}

export interface SupportTicket {
  id: string;
  userName: string;
  subject: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "resolved" | "closed";
  assignee?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  sortOrder: number;
  icon: string;
  bannerImage: string;
  status: "active" | "hidden";
  featured: boolean;
  productCount: number;
  metaTitle: string;
  metaDescription: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  adminName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  ip: string;
  timestamp: string;
}

export type NotificationChannel = "push" | "email" | "banner";
export type NotificationStatus = "sent" | "draft" | "scheduled";
export type AudienceSegment = "all" | "buyers" | "sellers" | "verified_sellers" | "selected_users";

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject?: string;
  title?: string;
  body: string;
  preview: string;
}

export interface NotificationHistoryItem {
  id: string;
  channel: NotificationChannel;
  title: string;
  audience: string;
  status: NotificationStatus;
  scheduledFor?: string;
  sentAt: string;
}

export interface PlanFeature {
  id: string;
  text: string;
  order: number;
}

export interface PlanLimits {
  maxProducts: number | null;
  maxImages: number | null;
  maxCommunities: number | null;
  maxTeamMembers: number | null;
  maxStorage: number | null;
}

export type PromotionKind = "topSeller" | "hotDeal" | "featuredPost" | "spotlight";

export type PromotionStatus = "pending_payment" | "active" | "expired" | "refunded";

export interface PromotionPurchase {
  id: string;
  kind: PromotionKind;
  packageName: string;
  amountPaid: number;
  currency: string;
  durationDays: number;
  sellerId: string;
  sellerName: string;
  sellerLogo?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  postId?: string;
  postTitle?: string;
  postImage?: string;
  status: PromotionStatus;
  position?: number;
  isPinned: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  views: number;
  clicks: number;
}

export const PROMOTION_KIND_LABEL: Record<PromotionKind, string> = {
  topSeller: "Top Seller Spotlight",
  hotDeal: "Hot Deal",
  featuredPost: "Boost Post",
  spotlight: "Feed Spotlight",
};

export interface CommissionCategoryOverride {
  category: string;
  rate: number; // percent
}

export interface CommissionSettings {
  commissionRate: number; // percent, e.g. 8
  listingFee: number; // flat per listing
  payoutFee: number; // flat per withdrawal
  categoryOverrides: CommissionCategoryOverride[];
}

export interface Coupon {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string;
  status: "active" | "expired" | "disabled";
  createdAt: string;
}

export interface RevenueMetrics {
  monthlyRevenue: number;
  annualRevenue: number;
  activeSubscribers: number;
  renewalsThisMonth: number;
  churnRate: number;
  revenueHistory: { month: string; revenue: number; subscribers: number }[];
}

export interface AdminUser {
  id: string;
  name: string;
  loginId: string;
  email?: string;
  password?: string;
  avatar?: string;
  role: "super_admin" | "manager" | "moderator";
  status: "active" | "inactive";
  twoFactorEnabled?: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface KPIData {
  totalUsers: number;
  newUsersToday: number;
  onlineUsers: number;
  verifiedSellers: number;
  pendingSellerRequests: number;
  totalProducts: number;
  pendingProducts: number;
  communities: number;
  ordersToday: number;
  revenue: number;
  /** Money-out via approved/refunded refunds (subtracted for net revenue). */
  refundsOut: number;
  /** Delivered gross minus refundsOut (floored at 0). */
  netRevenue: number;
  pendingReports: number;
  openSupportTickets: number;
}
