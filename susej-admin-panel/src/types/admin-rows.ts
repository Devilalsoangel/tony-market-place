/**
 * Row shapes for admin data-table pages that read live /api/data resources.
 * These describe what a real database row looks like after JSON serialisation.
 * They used to live in services/mock-data.ts; they are pure types now and no
 * demo arrays exist anywhere in this file.
 */

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

export interface MockBlockedUser {
  id: string;
  userName: string;
  email: string;
  reason: string;
  bannedBy: string;
  bannedAt: string;
  kind: "blocked" | "banned";
}

export interface MockAddressBookEntry {
  id: string;
  userName: string;
  label: string;
  address: string;
  city: string;
  phone: string;
  isDefault: boolean;
}

export interface MockPaymentMethod {
  id: string;
  userName: string;
  type: "card" | "upi" | "wallet" | "bank" | "cod";
  brand: string;
  last4: string;
  status: "active" | "expired" | "disabled";
  addedAt: string;
}

export interface MockLiveStream {
  id: string;
  title: string;
  hostName: string;
  viewers: number;
  status: "live" | "ended" | "scheduled";
  startedAt: string;
}

export interface MockReel {
  id: string;
  title: string;
  creatorName: string;
  views: number;
  likes: number;
  status: "published" | "flagged";
  createdAt: string;
}

export interface MockStory {
  id: string;
  creatorName: string;
  views: number;
  status: "active" | "expired";
  createdAt: string;
}

export interface MockHashtag {
  id: string;
  tag: string;
  postsCount: number;
  followers: number;
  trending: boolean;
  status: "active" | "blocked";
}

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

export interface MockFoodItem {
  id: string;
  title: string;
  category: string;
  price: number;
  restaurant: string;
  rating: number;
  status: "available" | "out_of_stock" | "pending";
}

export interface MockBroadcast {
  id: string;
  title: string;
  hostName: string;
  listeners: number;
  status: "live" | "scheduled" | "ended";
  scheduledAt: string;
}

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

export interface MockLoyaltyUser {
  id: string;
  userName: string;
  points: number;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  referrals: number;
  rewardsRedeemed: number;
  joinedAt: string;
}

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
