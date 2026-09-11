-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorCode" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'buyer',
    "status" TEXT NOT NULL DEFAULT 'active',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "username" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "interests" JSONB,
    "isSeller" BOOLEAN NOT NULL DEFAULT false,
    "businessName" TEXT,
    "category" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'none',
    "walletBalance" INTEGER NOT NULL DEFAULT 0,
    "passwordHash" TEXT,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "category" TEXT,
    "storeLat" DOUBLE PRECISION,
    "storeLng" DOUBLE PRECISION,
    "storeAddress" TEXT,
    "taxId" TEXT NOT NULL,
    "kycStatus" TEXT NOT NULL,
    "gstStatus" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "productsCount" INTEGER NOT NULL,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerDocument" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL,

    CONSTRAINT "SellerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerAuditLog" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "icon" TEXT NOT NULL,
    "bannerImage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL,
    "productCount" INTEGER NOT NULL,
    "metaTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "images" JSONB NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reports" INTEGER NOT NULL,
    "warningReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL,
    "items" INTEGER NOT NULL,
    "itemsList" JSONB NOT NULL,
    "shippingCarrier" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "estimatedDelivery" TEXT NOT NULL,
    "actualDelivery" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryLog" JSONB NOT NULL,
    "orderNumber" TEXT,
    "buyerUsername" TEXT,
    "sellerUsername" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "reviewComment" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sellerRating" DOUBLE PRECISION,
    "buyerRating" DOUBLE PRECISION,
    "sellerUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "members" INTEGER NOT NULL,
    "posts" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reports" INTEGER NOT NULL,
    "postingLocked" BOOLEAN NOT NULL,
    "commentsDisabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "memberList" JSONB NOT NULL,
    "postList" JSONB NOT NULL,
    "commentList" JSONB NOT NULL,
    "reportedList" JSONB NOT NULL,
    "moderationLog" JSONB NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "partyRole" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayLog" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "estimatedDelivery" TEXT NOT NULL,
    "deliveredAt" TEXT NOT NULL,
    "items" INTEGER NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "avgDeliveryDays" INTEGER NOT NULL,
    "onTimeRate" DOUBLE PRECISION,
    "shipments" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "eta" TEXT NOT NULL,
    "coverage" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignee" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "preview" TEXT NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationHistoryItem" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scheduledFor" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationHistoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "yearlyPrice" DOUBLE PRECISION NOT NULL,
    "trialDays" INTEGER NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "billing" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "usageLimit" INTEGER NOT NULL,
    "usedCount" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueMetrics" (
    "id" TEXT NOT NULL,
    "monthlyRevenue" DOUBLE PRECISION NOT NULL,
    "annualRevenue" DOUBLE PRECISION NOT NULL,
    "activeSubscribers" INTEGER NOT NULL,
    "renewalsThisMonth" INTEGER NOT NULL,
    "churnRate" DOUBLE PRECISION NOT NULL,
    "revenueHistory" JSONB NOT NULL,

    CONSTRAINT "RevenueMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TopSeller" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerLogo" TEXT NOT NULL,
    "totalSales" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "isPinned" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopSeller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotDeal" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productImage" TEXT NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "discountedPrice" DOUBLE PRECISION NOT NULL,
    "discountPercentage" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedPost" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isPinned" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TEXT NOT NULL DEFAULT '',
    "endDate" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "HomeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorefrontBanner" (
    "id" TEXT NOT NULL,
    "sellerUsername" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "ctaLabel" TEXT,
    "imageUrl" TEXT,
    "imageIndex" INTEGER,
    "size" TEXT,
    "position" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorefrontBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionPurchase" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "durationDays" INTEGER NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerLogo" TEXT,
    "productId" TEXT,
    "productName" TEXT,
    "productImage" TEXT,
    "originalPrice" DOUBLE PRECISION,
    "discountedPrice" DOUBLE PRECISION,
    "postId" TEXT,
    "postTitle" TEXT,
    "postImage" TEXT,
    "postExcerpt" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "providerPaymentId" TEXT,
    "checkoutRef" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "position" INTEGER,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportedUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "joinedAt" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reports" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "reportDetails" JSONB NOT NULL,

    CONSTRAINT "ReportedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportedProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reporter" TEXT NOT NULL,
    "reportCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportedMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "participants" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reportCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportedComment" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "postTitle" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reportCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportedComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorUsername" TEXT,
    "sellerLocation" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "price" DOUBLE PRECISION,
    "mrp" DOUBLE PRECISION,
    "description" TEXT,
    "category" TEXT,
    "subCategories" JSONB,
    "hashtags" JSONB,
    "images" JSONB,
    "type" TEXT NOT NULL DEFAULT 'product',
    "status" TEXT NOT NULL DEFAULT 'active',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "isSold" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "condition" TEXT,
    "brand" TEXT,
    "variants" JSONB,
    "stockLeft" INTEGER,
    "negotiable" BOOLEAN,
    "listingLat" DOUBLE PRECISION,
    "listingLng" DOUBLE PRECISION,
    "listingLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedUser" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "BlockedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressBookEntry" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL,

    CONSTRAINT "AddressBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveStream" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "hostUsername" TEXT NOT NULL DEFAULT '',
    "viewers" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reel" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "caption" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 5000,
    "overlays" JSONB,
    "productRef" JSONB,
    "views" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hashtag" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "postsCount" INTEGER NOT NULL,
    "followers" INTEGER NOT NULL,
    "trending" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Hashtag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemsCount" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discount" INTEGER NOT NULL,
    "sellerName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodHubItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "restaurant" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "FoodHubItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "listeners" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyUser" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "referrals" INTEGER NOT NULL,
    "rewardsRedeemed" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT,
    "note" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentBid" DOUBLE PRECISION NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "bids" INTEGER NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerUsername" TEXT NOT NULL,
    "startPrice" DOUBLE PRECISION,
    "imageKey" TEXT,
    "startsAt" TIMESTAMP(3),

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderRef" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionSetting" (
    "id" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "listingFee" DOUBLE PRECISION NOT NULL,
    "payoutFee" DOUBLE PRECISION NOT NULL,
    "categoryOverrides" JSONB NOT NULL,

    CONSTRAINT "CommissionSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "follower" TEXT NOT NULL,
    "followed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "username" TEXT,
    "parentId" TEXT,
    "text" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "likedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "participantA" TEXT NOT NULL,
    "participantB" TEXT NOT NULL,
    "lastMessage" TEXT,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinnedUntil" TIMESTAMP(3),
    "pinnedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "receiver" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userHandle" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "targetId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidder" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMessage" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorUsername" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_loginId_key" ON "Admin"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_verification_idx" ON "User"("verification");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_joinedAt_idx" ON "User"("joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_buyerUsername_idx" ON "Order"("buyerUsername");

-- CreateIndex
CREATE INDEX "Order_sellerUsername_idx" ON "Order"("sellerUsername");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_adminName_idx" ON "AuditLog"("adminName");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "HomeSection_name_key" ON "HomeSection"("name");

-- CreateIndex
CREATE INDEX "StorefrontBanner_sellerUsername_idx" ON "StorefrontBanner"("sellerUsername");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionPurchase_providerPaymentId_key" ON "PromotionPurchase"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionPurchase_checkoutRef_key" ON "PromotionPurchase"("checkoutRef");

-- CreateIndex
CREATE INDEX "Post_status_createdAt_idx" ON "Post"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Post_authorUsername_idx" ON "Post"("authorUsername");

-- CreateIndex
CREATE INDEX "Post_category_idx" ON "Post"("category");

-- CreateIndex
CREATE UNIQUE INDEX "AppSession_token_key" ON "AppSession"("token");

-- CreateIndex
CREATE INDEX "Follow_followed_idx" ON "Follow"("followed");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_follower_followed_key" ON "Follow"("follower", "followed");

-- CreateIndex
CREATE INDEX "PostLike_postId_idx" ON "PostLike"("postId");

-- CreateIndex
CREATE INDEX "PostLike_username_idx" ON "PostLike"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_username_key" ON "PostLike"("postId", "username");

-- CreateIndex
CREATE INDEX "PostComment_postId_idx" ON "PostComment"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_participantA_participantB_key" ON "ChatThread"("participantA", "participantB");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_idx" ON "ChatMessage"("threadId");

-- CreateIndex
CREATE INDEX "WalletTransaction_username_idx" ON "WalletTransaction"("username");

-- CreateIndex
CREATE INDEX "WalletTransaction_ts_idx" ON "WalletTransaction"("ts");

-- CreateIndex
CREATE INDEX "AuctionBid_auctionId_idx" ON "AuctionBid"("auctionId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDocument" ADD CONSTRAINT "SellerDocument_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAuditLog" ADD CONSTRAINT "SellerAuditLog_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSession" ADD CONSTRAINT "AppSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
