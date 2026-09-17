--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AddressBookEntry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AddressBookEntry" (
    id text NOT NULL,
    "userName" text NOT NULL,
    label text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    phone text NOT NULL,
    "isDefault" boolean NOT NULL
);



--
-- Name: Admin; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Admin" (
    id text NOT NULL,
    name text NOT NULL,
    "loginId" text NOT NULL,
    email text,
    "passwordHash" text NOT NULL,
    avatar text,
    role text NOT NULL,
    status text NOT NULL,
    "twoFactorEnabled" boolean DEFAULT false NOT NULL,
    "twoFactorCode" text,
    "failedAttempts" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone NOT NULL,
    "lastLogin" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: AppSession; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AppSession" (
    id text NOT NULL,
    token text NOT NULL,
    "userId" text NOT NULL,
    username text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: AppSetting; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AppSetting" (
    key text NOT NULL,
    value jsonb NOT NULL
);



--
-- Name: Auction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Auction" (
    id text NOT NULL,
    title text NOT NULL,
    status text NOT NULL,
    "currentBid" double precision NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    bids integer NOT NULL,
    "sellerName" text NOT NULL,
    "sellerUsername" text NOT NULL,
    "startPrice" double precision,
    "imageKey" text,
    "startsAt" timestamp(3) without time zone
);



--
-- Name: AuctionBid; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AuctionBid" (
    id text NOT NULL,
    "auctionId" text NOT NULL,
    bidder text NOT NULL,
    amount double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "adminName" text NOT NULL,
    action text NOT NULL,
    entity text NOT NULL,
    "entityId" text NOT NULL,
    details text NOT NULL,
    ip text NOT NULL,
    "timestamp" timestamp(3) without time zone NOT NULL
);



--
-- Name: BlockedUser; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."BlockedUser" (
    id text NOT NULL,
    "userName" text NOT NULL,
    email text NOT NULL,
    reason text NOT NULL,
    "bannedBy" text NOT NULL,
    "bannedAt" timestamp(3) without time zone NOT NULL,
    kind text NOT NULL
);



--
-- Name: Booking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Booking" (
    id text NOT NULL,
    "serviceName" text NOT NULL,
    "customerName" text NOT NULL,
    "sellerName" text NOT NULL,
    date text NOT NULL,
    "time" text NOT NULL,
    price double precision NOT NULL,
    status text NOT NULL
);



--
-- Name: Broadcast; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Broadcast" (
    id text NOT NULL,
    title text NOT NULL,
    "hostName" text NOT NULL,
    listeners integer NOT NULL,
    status text NOT NULL,
    "scheduledAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: Bundle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Bundle" (
    id text NOT NULL,
    title text NOT NULL,
    "itemsCount" integer NOT NULL,
    price double precision NOT NULL,
    discount integer NOT NULL,
    "sellerName" text NOT NULL,
    status text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: Carrier; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Carrier" (
    id text NOT NULL,
    name text NOT NULL,
    rate double precision NOT NULL,
    "avgDeliveryDays" integer NOT NULL,
    "onTimeRate" double precision,
    shipments integer NOT NULL,
    active boolean NOT NULL
);



--
-- Name: Category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text NOT NULL,
    "parentId" text,
    "sortOrder" integer NOT NULL,
    icon text NOT NULL,
    "bannerImage" text NOT NULL,
    status text NOT NULL,
    featured boolean NOT NULL,
    "productCount" integer NOT NULL,
    "metaTitle" text NOT NULL,
    "metaDescription" text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ChatMessage" (
    id text NOT NULL,
    "threadId" text NOT NULL,
    sender text NOT NULL,
    receiver text NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: ChatThread; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ChatThread" (
    id text NOT NULL,
    "participantA" text NOT NULL,
    "participantB" text NOT NULL,
    "lastMessage" text,
    "lastAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pinnedUntil" timestamp(3) without time zone,
    "pinnedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: CommissionSetting; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CommissionSetting" (
    id text NOT NULL,
    "commissionRate" double precision NOT NULL,
    "listingFee" double precision NOT NULL,
    "payoutFee" double precision NOT NULL,
    "categoryOverrides" jsonb NOT NULL
);



--
-- Name: Community; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Community" (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    "ownerName" text NOT NULL,
    members integer NOT NULL,
    posts integer NOT NULL,
    type text NOT NULL,
    status text NOT NULL,
    reports integer NOT NULL,
    "postingLocked" boolean NOT NULL,
    "commentsDisabled" boolean NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL,
    "memberList" jsonb NOT NULL,
    "postList" jsonb NOT NULL,
    "commentList" jsonb NOT NULL,
    "reportedList" jsonb NOT NULL,
    "moderationLog" jsonb NOT NULL
);



--
-- Name: CommunityMessage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CommunityMessage" (
    id text NOT NULL,
    "communityId" text NOT NULL,
    author text NOT NULL,
    "authorUsername" text NOT NULL,
    text text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: Coupon; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Coupon" (
    id text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    value double precision NOT NULL,
    "usageLimit" integer NOT NULL,
    "usedCount" integer NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    status text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: DeliveryZone; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DeliveryZone" (
    id text NOT NULL,
    name text NOT NULL,
    region text NOT NULL,
    rate double precision NOT NULL,
    eta text NOT NULL,
    coverage integer NOT NULL,
    active boolean NOT NULL
);



--
-- Name: Dispute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Dispute" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "buyerName" text NOT NULL,
    "sellerName" text NOT NULL,
    reason text NOT NULL,
    amount double precision NOT NULL,
    status text NOT NULL,
    "raisedAt" timestamp(3) without time zone NOT NULL,
    outcome text,
    note text,
    "resolvedAt" timestamp(3) without time zone
);



--
-- Name: FeaturedPost; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FeaturedPost" (
    id text NOT NULL,
    "postId" text NOT NULL,
    title text NOT NULL,
    excerpt text NOT NULL,
    "imageUrl" text NOT NULL,
    "position" integer NOT NULL,
    "isPinned" boolean NOT NULL,
    status text NOT NULL,
    "startDate" text DEFAULT ''::text NOT NULL,
    "endDate" text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: Follow; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Follow" (
    id text NOT NULL,
    follower text NOT NULL,
    followed text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: FoodHubItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FoodHubItem" (
    id text NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    price double precision NOT NULL,
    restaurant text NOT NULL,
    rating double precision NOT NULL,
    status text NOT NULL
);



--
-- Name: GatewayLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."GatewayLog" (
    id text NOT NULL,
    gateway text NOT NULL,
    event text NOT NULL,
    amount double precision NOT NULL,
    status text NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: Hashtag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Hashtag" (
    id text NOT NULL,
    tag text NOT NULL,
    "postsCount" integer NOT NULL,
    followers integer NOT NULL,
    trending boolean NOT NULL,
    status text NOT NULL
);



--
-- Name: HomeSection; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HomeSection" (
    id text NOT NULL,
    name text NOT NULL,
    title text NOT NULL,
    "isEnabled" boolean NOT NULL,
    "position" integer NOT NULL
);



--
-- Name: HotDeal; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HotDeal" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "productName" text NOT NULL,
    "productImage" text NOT NULL,
    "originalPrice" double precision NOT NULL,
    "discountedPrice" double precision NOT NULL,
    "discountPercentage" integer NOT NULL,
    "startDate" text NOT NULL,
    "endDate" text NOT NULL,
    priority integer NOT NULL,
    status text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: LedgerEntry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LedgerEntry" (
    id text NOT NULL,
    "partyName" text NOT NULL,
    "partyRole" text NOT NULL,
    direction text NOT NULL,
    type text NOT NULL,
    amount double precision NOT NULL,
    method text NOT NULL,
    status text NOT NULL,
    "orderId" text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: LiveStream; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LiveStream" (
    id text NOT NULL,
    title text NOT NULL,
    "hostName" text NOT NULL,
    "hostUsername" text DEFAULT ''::text NOT NULL,
    viewers integer NOT NULL,
    status text NOT NULL,
    "startedAt" timestamp(3) without time zone NOT NULL,
    "endedAt" timestamp(3) without time zone
);



--
-- Name: LoyaltyUser; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LoyaltyUser" (
    id text NOT NULL,
    "userName" text NOT NULL,
    points integer NOT NULL,
    tier text NOT NULL,
    referrals integer NOT NULL,
    "rewardsRedeemed" integer NOT NULL,
    "joinedAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: Message; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    "threadId" text NOT NULL,
    sender text NOT NULL,
    "senderRole" text NOT NULL,
    body text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: NotificationHistoryItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."NotificationHistoryItem" (
    id text NOT NULL,
    channel text NOT NULL,
    title text NOT NULL,
    audience text NOT NULL,
    status text NOT NULL,
    "scheduledFor" text,
    "sentAt" timestamp(3) without time zone
);



--
-- Name: NotificationTemplate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."NotificationTemplate" (
    id text NOT NULL,
    name text NOT NULL,
    channel text NOT NULL,
    subject text,
    title text,
    body text NOT NULL,
    preview text NOT NULL
);



--
-- Name: Order; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "buyerName" text NOT NULL,
    "sellerName" text NOT NULL,
    amount double precision NOT NULL,
    status text NOT NULL,
    "deliveryStatus" text NOT NULL,
    items integer NOT NULL,
    "itemsList" jsonb NOT NULL,
    "shippingCarrier" text NOT NULL,
    "trackingNumber" text NOT NULL,
    "estimatedDelivery" text NOT NULL,
    "actualDelivery" text NOT NULL,
    "shippingAddress" text NOT NULL,
    "paymentMethod" text NOT NULL,
    "paymentStatus" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deliveryLog" jsonb NOT NULL,
    "orderNumber" text,
    "buyerUsername" text,
    "sellerUsername" text,
    reviewed boolean DEFAULT false NOT NULL,
    rating integer,
    "reviewComment" text,
    "placedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: PasswordResetToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PasswordResetToken" (
    id text NOT NULL,
    "adminId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: PaymentMethod; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PaymentMethod" (
    id text NOT NULL,
    "userName" text NOT NULL,
    type text NOT NULL,
    brand text NOT NULL,
    last4 text NOT NULL,
    status text NOT NULL,
    "addedAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: Post; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Post" (
    id text NOT NULL,
    title text NOT NULL,
    "authorName" text NOT NULL,
    "authorUsername" text,
    "sellerLocation" text,
    verified boolean DEFAULT false NOT NULL,
    price double precision,
    mrp double precision,
    description text,
    category text,
    "subCategories" jsonb,
    hashtags jsonb,
    images jsonb,
    type text DEFAULT 'product'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    comments integer DEFAULT 0 NOT NULL,
    "isSold" boolean DEFAULT false NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    condition text,
    brand text,
    variants jsonb,
    "stockLeft" integer,
    negotiable boolean,
    "listingLat" double precision,
    "listingLng" double precision,
    "listingLocation" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: PostComment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PostComment" (
    id text NOT NULL,
    "postId" text NOT NULL,
    author text NOT NULL,
    username text,
    "parentId" text,
    text text NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    "likedBy" text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: PostLike; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PostLike" (
    id text NOT NULL,
    "postId" text NOT NULL,
    username text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: Product; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    title text NOT NULL,
    images jsonb NOT NULL,
    price double precision NOT NULL,
    category text NOT NULL,
    "sellerName" text NOT NULL,
    status text NOT NULL,
    reports integer NOT NULL,
    "warningReason" text,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: PromotionPurchase; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PromotionPurchase" (
    id text NOT NULL,
    kind text NOT NULL,
    "packageName" text NOT NULL,
    "amountPaid" double precision NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    "durationDays" integer NOT NULL,
    "sellerId" text NOT NULL,
    "sellerName" text NOT NULL,
    "sellerLogo" text,
    "productId" text,
    "productName" text,
    "productImage" text,
    "originalPrice" double precision,
    "discountedPrice" double precision,
    "postId" text,
    "postTitle" text,
    "postImage" text,
    "postExcerpt" text,
    provider text DEFAULT 'manual'::text NOT NULL,
    "providerPaymentId" text,
    "checkoutRef" text NOT NULL,
    status text NOT NULL,
    "position" integer,
    "isPinned" boolean DEFAULT false NOT NULL,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: Reel; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Reel" (
    id text NOT NULL,
    title text NOT NULL,
    "creatorName" text NOT NULL,
    views integer NOT NULL,
    likes integer NOT NULL,
    status text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: Refund; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Refund" (
    id text NOT NULL,
    "orderRef" text NOT NULL,
    "buyerName" text NOT NULL,
    "sellerName" text NOT NULL,
    reason text NOT NULL,
    amount double precision NOT NULL,
    status text NOT NULL,
    "requestedAt" timestamp(3) without time zone NOT NULL,
    "respondedAt" timestamp(3) without time zone
);



--
-- Name: ReportedComment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ReportedComment" (
    id text NOT NULL,
    "commentId" text NOT NULL,
    "postTitle" text NOT NULL,
    "authorName" text NOT NULL,
    text text NOT NULL,
    reason text NOT NULL,
    "reportCount" integer NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: ReportedMessage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ReportedMessage" (
    id text NOT NULL,
    "threadId" text NOT NULL,
    participants text NOT NULL,
    preview text NOT NULL,
    reason text NOT NULL,
    severity text NOT NULL,
    "reportCount" integer NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: ReportedProduct; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ReportedProduct" (
    id text NOT NULL,
    "productId" text NOT NULL,
    title text NOT NULL,
    "sellerName" text NOT NULL,
    reason text NOT NULL,
    reporter text NOT NULL,
    "reportCount" integer NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: ReportedUser; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ReportedUser" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "joinedAt" text NOT NULL,
    reason text NOT NULL,
    reports integer NOT NULL,
    status text NOT NULL,
    "reportDetails" jsonb NOT NULL
);



--
-- Name: RevenueMetrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RevenueMetrics" (
    id text NOT NULL,
    "monthlyRevenue" double precision NOT NULL,
    "annualRevenue" double precision NOT NULL,
    "activeSubscribers" integer NOT NULL,
    "renewalsThisMonth" integer NOT NULL,
    "churnRate" double precision NOT NULL,
    "revenueHistory" jsonb NOT NULL
);



--
-- Name: Review; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Review" (
    id text NOT NULL,
    "productName" text NOT NULL,
    "reviewerName" text NOT NULL,
    rating integer NOT NULL,
    text text NOT NULL,
    status text NOT NULL,
    "sellerRating" double precision,
    "buyerRating" double precision,
    "sellerUsername" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: Seller; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Seller" (
    id text NOT NULL,
    "businessName" text NOT NULL,
    "ownerName" text NOT NULL,
    logo text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    address text NOT NULL,
    category text,
    "storeLat" double precision,
    "storeLng" double precision,
    "storeAddress" text,
    "taxId" text NOT NULL,
    "kycStatus" text NOT NULL,
    "gstStatus" text NOT NULL,
    score integer NOT NULL,
    "productsCount" integer NOT NULL,
    "totalSales" integer DEFAULT 0 NOT NULL,
    rating double precision DEFAULT 0 NOT NULL,
    "reviewCount" integer DEFAULT 0 NOT NULL,
    "joinedAt" timestamp(3) without time zone NOT NULL,
    "submittedAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: SellerAuditLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SellerAuditLog" (
    id text NOT NULL,
    "sellerId" text NOT NULL,
    action text NOT NULL,
    "adminName" text NOT NULL,
    note text NOT NULL,
    "timestamp" timestamp(3) without time zone NOT NULL
);



--
-- Name: SellerDocument; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SellerDocument" (
    id text NOT NULL,
    "sellerId" text NOT NULL,
    type text NOT NULL,
    label text NOT NULL,
    "fileName" text NOT NULL,
    url text NOT NULL,
    "uploadedAt" timestamp(3) without time zone NOT NULL,
    verified boolean NOT NULL
);



--
-- Name: Shipment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Shipment" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "buyerName" text NOT NULL,
    destination text NOT NULL,
    carrier text NOT NULL,
    "trackingNumber" text NOT NULL,
    status text NOT NULL,
    "estimatedDelivery" text NOT NULL,
    "deliveredAt" text NOT NULL,
    items integer NOT NULL
);



--
-- Name: StorefrontBanner; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."StorefrontBanner" (
    id text NOT NULL,
    "sellerUsername" text NOT NULL,
    "sellerName" text NOT NULL,
    title text NOT NULL,
    subtitle text,
    "ctaLabel" text,
    "imageUrl" text,
    "imageIndex" integer,
    size text,
    "position" integer,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: Story; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Story" (
    id text NOT NULL,
    username text NOT NULL,
    "creatorName" text DEFAULT ''::text NOT NULL,
    image text DEFAULT ''::text NOT NULL,
    caption text,
    "durationMs" integer DEFAULT 5000 NOT NULL,
    overlays jsonb,
    "productRef" jsonb,
    views integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: Subscriber; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Subscriber" (
    id text NOT NULL,
    "userName" text NOT NULL,
    email text NOT NULL,
    "planName" text NOT NULL,
    status text NOT NULL,
    billing text NOT NULL,
    "startedAt" timestamp(3) without time zone NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "cancelledAt" timestamp(3) without time zone
);



--
-- Name: SubscriptionPlan; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SubscriptionPlan" (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    badge text NOT NULL,
    "monthlyPrice" double precision NOT NULL,
    "yearlyPrice" double precision NOT NULL,
    "trialDays" integer NOT NULL,
    "billingCycle" text NOT NULL,
    features jsonb NOT NULL,
    limits jsonb NOT NULL,
    settings jsonb NOT NULL,
    status text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: SupportTicket; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SupportTicket" (
    id text NOT NULL,
    "userName" text NOT NULL,
    subject text NOT NULL,
    priority text NOT NULL,
    status text NOT NULL,
    assignee text,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: TopSeller; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TopSeller" (
    id text NOT NULL,
    "sellerId" text NOT NULL,
    "sellerName" text NOT NULL,
    "sellerLogo" text NOT NULL,
    "totalSales" integer NOT NULL,
    rating double precision NOT NULL,
    "reviewCount" integer NOT NULL,
    "position" integer NOT NULL,
    "isPinned" boolean NOT NULL,
    status text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: Transaction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Transaction" (
    id text NOT NULL,
    "userName" text NOT NULL,
    type text NOT NULL,
    amount double precision NOT NULL,
    method text NOT NULL,
    gateway text NOT NULL,
    reference text NOT NULL,
    status text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL
);



--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    avatar text,
    role text DEFAULT 'buyer'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    phone text,
    username text,
    bio text,
    location text,
    interests jsonb,
    "isSeller" boolean DEFAULT false NOT NULL,
    "businessName" text,
    category text,
    verification text DEFAULT 'none'::text NOT NULL,
    "walletBalance" integer DEFAULT 0 NOT NULL,
    "passwordHash" text,
    "loyaltyPoints" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: UserNotification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."UserNotification" (
    id text NOT NULL,
    username text NOT NULL,
    type text NOT NULL,
    "userName" text NOT NULL,
    "userHandle" text,
    action text NOT NULL,
    target text,
    "targetId" text,
    read boolean DEFAULT false NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: WalletTransaction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."WalletTransaction" (
    id text NOT NULL,
    username text NOT NULL,
    title text NOT NULL,
    detail text NOT NULL,
    amount double precision NOT NULL,
    ts timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: WebhookEvent; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."WebhookEvent" (
    id text NOT NULL,
    provider text NOT NULL,
    "eventType" text NOT NULL,
    payload jsonb NOT NULL,
    signature text,
    "processedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: Withdrawal; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Withdrawal" (
    id text NOT NULL,
    "userName" text NOT NULL,
    method text NOT NULL,
    amount double precision NOT NULL,
    status text NOT NULL,
    "requestedAt" timestamp(3) without time zone NOT NULL,
    "respondedAt" timestamp(3) without time zone
);



--
-- Data for Name: AddressBookEntry; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AddressBookEntry" (id, "userName", label, address, city, phone, "isDefault") FROM stdin;
\.


--
-- Data for Name: Admin; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Admin" (id, name, "loginId", email, "passwordHash", avatar, role, status, "twoFactorEnabled", "twoFactorCode", "failedAttempts", "lockedUntil", "createdAt", "lastLogin", "updatedAt") FROM stdin;
admin_2	Jordan Chen	jordanchen	jordan@admin.com	24caf9af6e26c49d1880ab9c06a4705e:a6fddfc5a10c493e148ea8919e702027e4e9f03115f89c9d7b8f9881e8b68fbdc4140c6efe28809cb7198ff281a1caecfe4d3174cbe1033b7972d25ffd6da579	\N	super_admin	active	f	\N	0	\N	2024-01-01 00:00:00	\N	2026-09-06 09:49:01.233
admin_3	Sam Patel	sampatel	sam@admin.com	0d63861f030c2b51485f42a10f0df4f5:c38f4d60e034bee160ea34c4ebda761f335f0366171f29257d76692473cb5e92a121bad1e0e6ec55899274221db290e743d3dd06e4fae514a0f6cea1f26b9d09	\N	manager	active	f	\N	0	\N	2024-01-01 00:00:00	\N	2026-09-06 09:49:01.316
admin_4	Taylor Kim	taylorkim	taylor@admin.com	add2ce8c5059f178ccba8402de57bfc5:92c633a0cc02b7aed42daf4509d5eb122e1c7925213dc20d463121061859da9828a72fef767c619bffd58adfe7e2bc20ee7d1e28e8d12466aba09aaf116e0088	\N	manager	active	f	\N	0	\N	2024-01-01 00:00:00	\N	2026-09-06 09:49:01.399
admin_5	Morgan Lee	morganlee	morgan@admin.com	0de3fe5c2f5753109ba6132599cdaef5:a51263967c5186a013c5471f04cb8dbe16bd8e55afd0a119dae6fae526ea621a82870f71bdb4b2acb8131e6ec3565cf3b5d8fc47eeaaab86c3749bfb5a3e3831	\N	manager	inactive	f	\N	0	\N	2024-01-01 00:00:00	\N	2026-09-06 09:49:01.472
admin_6	Casey Johnson	caseyjohnson	casey@admin.com	e85ec58fb0ecce2a81233ab5fb7fbbb0:657038775da478eeb95b1fc3d41c26f56b8d659d9f297e80659f58092974e6b4657651387104c1a45cab812c2571b370e8c5d8358e52a12706871d061450bf46	\N	moderator	active	f	\N	0	\N	2024-01-01 00:00:00	\N	2026-09-06 09:49:01.544
admin_7	Riley Thompson	rileythompson	riley@admin.com	110638655f5fc17d45cae4e3efe682d1:86216dbad24df1e88dbba75df2215e239ebc6e2f7f28c01594a47f220561d43dd582778835eed6e38aaf2ac41d5a59b12c941beeadb39af243a7ce75658b78af	\N	moderator	active	f	\N	0	\N	2024-01-01 00:00:00	\N	2026-09-06 09:49:01.615
admin_8	Avery Garcia	averygarcia	avery@admin.com	69aa96ffb0a1b45e44c3ac9bf50e4786:c027d562e570ef7e104d296b50ff254c3c296f609c69fce0b62e3b3e80262290ffac85af591f6aa5b70b126a975e484bc9bad4eda8e467d26abd7e55fa906a20	\N	moderator	inactive	f	\N	0	\N	2024-01-01 00:00:00	\N	2026-09-06 09:49:01.692
admin_1	Alex Rivera	alexrivera	alex@admin.com	2a60011701ac6fe74019ef1b51e2bc28:0e9a6478da3729c08d5ed068869afb30bffcdaba7767993101bef64b82342421254d88fe9adef6df67087edb92ca5f225c4555d66c31d5cc9b3c39f952be4e20	\N	super_admin	active	t	7ec3db57df760fc2979598786c0835c5:af33d574a87a6e76dccffaea17723eeabdf4598bc3e0138ebd7b56e7bed817e706a28e75fb028d9896ba335b71e60829c19b4453d288ca25fc7b605c88d10900	0	\N	2024-01-01 00:00:00	2026-09-06 14:41:47.094	2026-09-06 14:41:47.096
\.


--
-- Data for Name: AppSession; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AppSession" (id, token, "userId", username, "createdAt", "expiresAt") FROM stdin;
cmtpnkxsv0006xkwldrvhiycb	susej_zFhQsr9vZW_2LzGIt4boNqOgn0yAIxlhp4o5-quqHwU	cmtpnkxrj0004xkwlifmz49ok	user0011	2026-09-06 10:12:40.351	2026-10-06 10:12:40.348
cmtpolymj0009xkwl4mm4diw2	susej_rT4jmJvtSjixuoM97A-MvEqxKcOhxIR_oa1mh-BdXdM	cmtpolykt0007xkwliomjjqgj	user0012	2026-09-06 10:41:27.691	2026-10-06 10:41:27.69
cmtpq5629000exkwlwxq58zpm	susej_TMeYTCv9kpIHR2RC9gRa-havr_GC4qA2hHJ_p-6_Qhs	cmtpq561h000cxkwlu65skkez	user0052	2026-09-06 11:24:23.409	2026-10-06 11:24:23.409
cmtpqewen000mxkwlvgfgpce8	susej_OWT2ta-HOTQNBWkWOf-KbjT8HfAZNiN0GQ75py60Yvg	cmtpqewe2000kxkwl532kwvz4	user0001	2026-09-06 11:31:57.455	2026-10-06 11:31:57.454
cmtpqewkh000pxkwlypkzrxwh	susej_rE77OPfI0cokpJ0PyG1iV4PsH2ob1bF7mnS6CRwwoFg	cmtpqewjq000nxkwlnxgmyijl	user0002	2026-09-06 11:31:57.665	2026-10-06 11:31:57.664
cmtpqf6qe000vxkwlerb9qnp3	susej_z_9mDNWQY6WI2IiMnxpwKg3N-7zloJJtRseE15CPotY	cmtpqf6px000txkwlbgu41wi9	tester_seed	2026-09-06 11:32:10.838	2026-10-06 11:32:10.837
cmtpqh14c000yxkwlhc7a47g0	susej_r3vzJsM8Z4rhiMjHyUS63jXr5PXSOab994UDQn2ju88	cmtpqewe2000kxkwl532kwvz4	user0001	2026-09-06 11:33:36.877	2026-10-06 11:33:36.876
cmtpqh192000zxkwl7776wnt3	susej_SaOwI2ZqGLGui25G1i2oyJPuZOMW3tKyDvU5XbOPNoU	cmtpqewjq000nxkwlnxgmyijl	user0002	2026-09-06 11:33:37.046	2026-10-06 11:33:37.045
cmtpqhdu30013xkwladtswncz	susej_PM56bReEynvC1UVds7RrqrzCowFdUrJDDCaIChijV-c	cmtpqhdto0011xkwlu4oc0kq1	user0004	2026-09-06 11:33:53.355	2026-10-06 11:33:53.353
cmtpv7fpz000214wlsjy5bp72	susej_TNH_fuLZwg9LWBqlOQ6j7frxNPP5tD5OBbShSc3gEvM	cmtpqewe2000kxkwl532kwvz4	user0001	2026-09-06 13:46:07.319	2026-10-06 13:46:07.317
cmtpv7fum000314wl5g26i7ap	susej_PxkzAhvUjSb-2vpWIkl-6AWidlplwpqSq87nLCzuogI	cmtpqewjq000nxkwlnxgmyijl	user0002	2026-09-06 13:46:07.486	2026-10-06 13:46:07.486
cmtpvc3ro000514wlv8s981u6	susej_0YTePqe-qXnys-8TCFZy9FJwA7ZfknM9bo6KaP3suBI	cmtpqewe2000kxkwl532kwvz4	user0001	2026-09-06 13:49:45.108	2026-10-06 13:49:45.107
cmtpx17u20000zowl5a015347	susej_kZ7IeopYIOZuGrBBLueTgLRHQNvFerhzWeLFu5RU-80	cmtpqewe2000kxkwl532kwvz4	user0001	2026-09-06 14:37:16.394	2026-10-06 14:37:16.388
cmtpx54km0001zowl0ndf7qhr	susej_S-tAj925ZTU1YSs1hkSUtcK3pWPhKqRE1IZ3zuw_0Dw	cmtpqewe2000kxkwl532kwvz4	user0001	2026-09-06 14:40:18.79	2026-10-06 14:40:18.787
cmtpx70rx0005zowliy0l3a9f	susej_3_SwhyQBiUv7FMXCdgzlSX-5MW1dPmbSQkW1HTb5kPE	cmtpqewe2000kxkwl532kwvz4	user0001	2026-09-06 14:41:47.181	2026-10-06 14:41:47.181
cmtpx711l0006zowlv7c33uyb	susej_JE03eVT9FV8Kh4E54GjbtijTBk-JlgNfsvuAq2Z_AMA	cmtpqewjq000nxkwlnxgmyijl	user0002	2026-09-06 14:41:47.529	2026-10-06 14:41:47.528
cmtpxace50008zowlqq6koaar	susej_N_3KtzZ5KD_yK0Jl0_sizsJGE3DrJ2IDOk7G-05Mycs	cmtpqewe2000kxkwl532kwvz4	user0001	2026-09-06 14:44:22.205	2026-10-06 14:44:22.204
cmtpyb240000czowlvdm61vq5	susej_9i7r8b71N0tr7dn8kn94wiZKSxiEjMJd5m3RJI285Zw	cmtpyb23j000azowl7g2maufg	gtester	2026-09-06 15:12:55.152	2026-10-06 15:12:55.151
cmtpyb256000dzowl3d8i3q53	susej_SsWkZa89iGvmThn53oxleIDecOF1NytbuQTWoXHLk_4	cmtpyb23j000azowl7g2maufg	gtester	2026-09-06 15:12:55.194	2026-10-06 15:12:55.194
cmtpz9rsc0002wowl630nfswd	susej_VAhSWA5xmQbGob7N79nrq1s11G77_-ciEc0KClAhTJg	cmtpz9rrn0000wowlj0kom6ej	numberbook999	2026-09-06 15:39:54.732	2026-10-06 15:39:54.729
cmtq0ifkp0005wowlmwv1ex1u	susej_5ouVh9hWzpk_at7xXovEuUKYAd7M7Y7tWbuMKhr_Eoc	cmtq0ifk60003wowl6syqihdm	tony	2026-09-06 16:14:38.425	2026-10-06 16:14:38.424
cmtq0imof0006wowl7gnfhl1i	susej_OGVd4Bv4WkEKjSwEY--ez7osfbgmL1-gqyY8SxozjRE	cmtq0ifk60003wowl6syqihdm	tony	2026-09-06 16:14:47.631	2026-10-06 16:14:47.63
cmtq1aeu70007wowlu8tloiol	susej_5OYpqacbO1liVpmBgr9oNmcAWL2UMIY2RIO4pWDhfm4	cmtq0ifk60003wowl6syqihdm	tony	2026-09-06 16:36:23.839	2026-10-06 16:36:23.838
\.


--
-- Data for Name: AppSetting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AppSetting" (key, value) FROM stdin;
siteName	"SUSEJ Marketplace"
defaultLanguage	"en"
currency	"inr"
timezone	"utc"
supportEmail	"support@susej.com"
platformRatePercent	2.9
otp:14155551234	{"exp": 1788711842665, "hash": "5ec24e7acdca17bc9a6c28ece80e8b16b67050338efdaa452395c62551adcf6e", "attempts": 0, "issuedAt": 1788711542665}
otp:4155551234	{"exp": 1788712304740, "hash": "e4f8c380ca4ce78a22d9a562c91b3643d588357f25d1bcf8c6913b854e3ac217", "attempts": 0, "issuedAt": 1788712004740}
\.


--
-- Data for Name: Auction; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Auction" (id, title, status, "currentBid", "endsAt", bids, "sellerName", "sellerUsername", "startPrice", "imageKey", "startsAt") FROM stdin;
\.


--
-- Data for Name: AuctionBid; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AuctionBid" (id, "auctionId", bidder, amount, "createdAt") FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AuditLog" (id, "adminName", action, entity, "entityId", details, ip, "timestamp") FROM stdin;
cmtpmqzgv0000xkwlg8yr7j8l	alexrivera	auth.pre_2fa	admins	admin_1	Password verified, awaiting 2FA code	::ffff:127.0.0.1	2026-09-06 09:49:22.81
cmtpmqzoy0001xkwl6dr0udhk	alexrivera	auth.login	admins	admin_1	Signed in (2FA)	::ffff:127.0.0.1	2026-09-06 09:49:23.121
cmtpnkx350002xkwlvs40q1w4	alexrivera	auth.pre_2fa	admins	admin_1	Password verified, awaiting 2FA code	::ffff:127.0.0.1	2026-09-06 10:12:39.42
cmtpnkxbk0003xkwlarznzd1m	alexrivera	auth.login	admins	admin_1	Signed in (2FA)	::ffff:127.0.0.1	2026-09-06 10:12:39.727
cmtpom6ec000axkwlua4nc67j	alexrivera	auth.pre_2fa	admins	admin_1	Password verified, awaiting 2FA code	::ffff:127.0.0.1	2026-09-06 10:41:37.762
cmtpom6ld000bxkwlrrpnoamy	alexrivera	auth.login	admins	admin_1	Signed in (2FA)	::ffff:127.0.0.1	2026-09-06 10:41:38.016
cmtpq978e000gxkwlcapzw4pf	alexrivera	auth.pre_2fa	admins	admin_1	Password verified, awaiting 2FA code	::ffff:127.0.0.1	2026-09-06 11:27:31.549
cmtpq9o8a000hxkwlr4hxmb2f	alexrivera	auth.pre_2fa	admins	admin_1	Password verified, awaiting 2FA code	::ffff:127.0.0.1	2026-09-06 11:27:53.577
cmtpqa60v000ixkwl71hrgr0a	alexrivera	auth.pre_2fa	admins	admin_1	Password verified, awaiting 2FA code	::ffff:127.0.0.1	2026-09-06 11:28:16.639
cmtpqa63r000jxkwlikbdawqk	alexrivera	auth.login	admins	admin_1	Signed in (2FA)	::ffff:127.0.0.1	2026-09-06 11:28:16.742
cmtpqewoa000rxkwl9rm6ysvl	alexrivera	auth.pre_2fa	admins	admin_1	Password verified, awaiting 2FA code	::ffff:127.0.0.1	2026-09-06 11:31:57.801
cmtpqewsy000sxkwlnocnvzor	alexrivera	auth.login	admins	admin_1	Signed in (2FA)	::ffff:127.0.0.1	2026-09-06 11:31:57.969
cmtpqh0yl000wxkwla0ckfwzi	alexrivera	auth.pre_2fa	admins	admin_1	Password verified, awaiting 2FA code	::ffff:127.0.0.1	2026-09-06 11:33:36.669
cmtpqh12p000xxkwl3ibtdcnc	alexrivera	auth.login	admins	admin_1	Signed in (2FA)	::ffff:127.0.0.1	2026-09-06 11:33:36.817
cmtpv7ffq000014wl8gxvjsb2	alexrivera	auth.pre_2fa	admins	admin_1	Password verified, awaiting 2FA code	::ffff:127.0.0.1	2026-09-06 13:46:06.938
cmtpv7fln000114wlaemdege8	alexrivera	auth.login	admins	admin_1	Signed in (2FA)	::ffff:127.0.0.1	2026-09-06 13:46:07.162
cmtpx54se0002zowljvuavwb0	Riya Sharma	data.create	sellers	app_user0001	Created record	::ffff:127.0.0.1	2026-09-06 14:40:19.069
cmtpx70jg0003zowlli45zuy0	alexrivera	auth.pre_2fa	admins	admin_1	Password verified, awaiting 2FA code	::ffff:127.0.0.1	2026-09-06 14:41:46.874
cmtpx70pq0004zowlbel0jejm	alexrivera	auth.login	admins	admin_1	Signed in (2FA)	::ffff:127.0.0.1	2026-09-06 14:41:47.101
cmtpxacky0009zowleal0kjmw	Riya Sharma	data.create	sellers	app_user0001	Seller KYC resubmitted (upsert)	::ffff:127.0.0.1	2026-09-06 14:44:22.448
\.


--
-- Data for Name: BlockedUser; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."BlockedUser" (id, "userName", email, reason, "bannedBy", "bannedAt", kind) FROM stdin;
\.


--
-- Data for Name: Booking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Booking" (id, "serviceName", "customerName", "sellerName", date, "time", price, status) FROM stdin;
\.


--
-- Data for Name: Broadcast; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Broadcast" (id, title, "hostName", listeners, status, "scheduledAt") FROM stdin;
\.


--
-- Data for Name: Bundle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Bundle" (id, title, "itemsCount", price, discount, "sellerName", status, "createdAt") FROM stdin;
\.


--
-- Data for Name: Carrier; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Carrier" (id, name, rate, "avgDeliveryDays", "onTimeRate", shipments, active) FROM stdin;
car_1	FedEx	12.5	3	\N	0	t
car_2	UPS	10.75	3	\N	0	t
car_3	DHL	14.9	2	\N	0	t
car_4	USPS	7.25	5	\N	0	t
car_5	BlueDart	8.9	4	\N	0	f
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Category" (id, name, slug, description, "parentId", "sortOrder", icon, "bannerImage", status, featured, "productCount", "metaTitle", "metaDescription", "createdAt", "updatedAt") FROM stdin;
cat_1	Fashion	fashion	All fashion products in one place.	\N	1	ðŸ‘—	https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	t	0	Buy Fashion Online - SUSEJ Marketplace	Shop the latest fashion collection at SUSEJ.	2026-06-08 09:49:00.688	2026-09-06 09:49:01.719
cat_2	Electronics	electronics	All electronics products in one place.	\N	2	ðŸ“±	https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	t	0	Buy Electronics Online - SUSEJ Marketplace	Shop the latest electronics collection at SUSEJ.	2026-05-29 09:49:00.688	2026-09-06 09:49:01.745
cat_3	Home & Living	home-living	All home & living products in one place.	\N	3	ðŸ 	https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	t	0	Buy Home & Living Online - SUSEJ Marketplace	Shop the latest home & living collection at SUSEJ.	2026-05-19 09:49:00.688	2026-09-06 09:49:01.757
cat_4	Beauty & Health	beauty-health	All beauty & health products in one place.	\N	4	ðŸ’„	https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	t	0	Buy Beauty & Health Online - SUSEJ Marketplace	Shop the latest beauty & health collection at SUSEJ.	2026-05-09 09:49:00.688	2026-09-06 09:49:01.768
cat_5	Food & Grocery	food-grocery	All food & grocery products in one place.	\N	5	ðŸ›’	https://images.unsplash.com/photo-1542838132-92c53300491e?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	t	0	Buy Food & Grocery Online - SUSEJ Marketplace	Shop the latest food & grocery collection at SUSEJ.	2026-04-29 09:49:00.688	2026-09-06 09:49:01.781
cat_6	Sports & Fitness	sports-fitness	All sports & fitness products in one place.	\N	6	ðŸ’ª	https://images.unsplash.com/photo-1517433670267-08bbd4be890f?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	t	0	Buy Sports & Fitness Online - SUSEJ Marketplace	Shop the latest sports & fitness collection at SUSEJ.	2026-04-19 09:49:00.688	2026-09-06 09:49:01.793
cat_7	Automotive	automotive	All automotive products in one place.	\N	7	ðŸš—	https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Automotive Online - SUSEJ Marketplace	Shop the latest automotive collection at SUSEJ.	2026-04-09 09:49:00.688	2026-09-06 09:49:01.806
cat_8	Books & Education	books-education	All books & education products in one place.	\N	8	ðŸ“š	https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Books & Education Online - SUSEJ Marketplace	Shop the latest books & education collection at SUSEJ.	2026-03-30 09:49:00.688	2026-09-06 09:49:01.818
cat_9	Men's Fashion	men-s-fashion	All men's fashion products in one place.	cat_1	9	ðŸ‘”	https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Men's Fashion Online - SUSEJ Marketplace	Shop the latest men's fashion collection at SUSEJ.	2026-03-20 09:49:00.688	2026-09-06 09:49:01.833
cat_10	Women's Fashion	women-s-fashion	All women's fashion products in one place.	cat_1	10	ðŸ‘—	https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Women's Fashion Online - SUSEJ Marketplace	Shop the latest women's fashion collection at SUSEJ.	2026-03-10 09:49:00.689	2026-09-06 09:49:01.845
cat_11	Kids Fashion	kids-fashion	All kids fashion products in one place.	cat_1	11	ðŸ§’	https://images.unsplash.com/photo-1542838132-92c53300491e?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Kids Fashion Online - SUSEJ Marketplace	Shop the latest kids fashion collection at SUSEJ.	2026-02-28 09:49:00.689	2026-09-06 09:49:01.855
cat_12	Mobile Phones	mobile-phones	All mobile phones products in one place.	cat_2	12	ðŸ“±	https://images.unsplash.com/photo-1517433670267-08bbd4be890f?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Mobile Phones Online - SUSEJ Marketplace	Shop the latest mobile phones collection at SUSEJ.	2026-02-18 09:49:00.689	2026-09-06 09:49:01.864
cat_13	Laptops & Computers	laptops-computers	All laptops & computers products in one place.	cat_2	13	ðŸ’»	https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Laptops & Computers Online - SUSEJ Marketplace	Shop the latest laptops & computers collection at SUSEJ.	2026-02-08 09:49:00.689	2026-09-06 09:49:01.876
cat_14	Audio & Headphones	audio-headphones	All audio & headphones products in one place.	cat_2	14	ðŸŽ§	https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Audio & Headphones Online - SUSEJ Marketplace	Shop the latest audio & headphones collection at SUSEJ.	2026-01-29 09:49:00.689	2026-09-06 09:49:01.885
cat_15	Cameras	cameras	All cameras products in one place.	cat_2	15	ðŸ“·	https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Cameras Online - SUSEJ Marketplace	Shop the latest cameras collection at SUSEJ.	2026-01-19 09:49:00.689	2026-09-06 09:49:01.895
cat_16	Furniture	furniture	All furniture products in one place.	cat_3	16	ðŸª‘	https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Furniture Online - SUSEJ Marketplace	Shop the latest furniture collection at SUSEJ.	2026-01-09 09:49:00.689	2026-09-06 09:49:01.906
cat_17	Kitchen & Dining	kitchen-dining	All kitchen & dining products in one place.	cat_3	17	ðŸ½ï¸	https://images.unsplash.com/photo-1542838132-92c53300491e?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Kitchen & Dining Online - SUSEJ Marketplace	Shop the latest kitchen & dining collection at SUSEJ.	2025-12-30 09:49:00.689	2026-09-06 09:49:01.916
cat_18	Home Decor	home-decor	All home decor products in one place.	cat_3	18	ðŸ–¼ï¸	https://images.unsplash.com/photo-1517433670267-08bbd4be890f?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	active	f	0	Buy Home Decor Online - SUSEJ Marketplace	Shop the latest home decor collection at SUSEJ.	2025-12-20 09:49:00.689	2026-09-06 09:49:01.931
cat_19	T-Shirts	t-shirts	All t-shirts products in one place.	cat_9	19	ðŸ‘•	https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	hidden	f	0	Buy T-Shirts Online - SUSEJ Marketplace	Shop the latest t-shirts collection at SUSEJ.	2025-12-10 09:49:00.689	2026-09-06 09:49:01.943
cat_20	Formal Wear	formal-wear	All formal wear products in one place.	cat_9	20	ðŸ¤µ	https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	hidden	f	0	Buy Formal Wear Online - SUSEJ Marketplace	Shop the latest formal wear collection at SUSEJ.	2025-11-30 09:49:00.689	2026-09-06 09:49:01.955
cat_21	Smartphones	smartphones	All smartphones products in one place.	cat_12	21	ðŸ“±	https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	hidden	f	0	Buy Smartphones Online - SUSEJ Marketplace	Shop the latest smartphones collection at SUSEJ.	2025-11-20 09:49:00.689	2026-09-06 09:49:01.966
cat_22	Accessories	accessories	All accessories products in one place.	cat_12	22	ðŸ“²	https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80	hidden	f	0	Buy Accessories Online - SUSEJ Marketplace	Shop the latest accessories collection at SUSEJ.	2025-11-10 09:49:00.689	2026-09-06 09:49:01.978
\.


--
-- Data for Name: ChatMessage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ChatMessage" (id, "threadId", sender, receiver, body, status, "createdAt") FROM stdin;
\.


--
-- Data for Name: ChatThread; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ChatThread" (id, "participantA", "participantB", "lastMessage", "lastAt", "pinnedUntil", "pinnedBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: CommissionSetting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CommissionSetting" (id, "commissionRate", "listingFee", "payoutFee", "categoryOverrides") FROM stdin;
global	8	0	20	[{"rate": 8, "category": "Fashion"}, {"rate": 10, "category": "Electronics"}, {"rate": 6, "category": "Automobiles"}, {"rate": 5, "category": "Food & Groceries"}, {"rate": 8, "category": "Beauty"}, {"rate": 12, "category": "Home Services"}]
\.


--
-- Data for Name: Community; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Community" (id, name, description, "ownerName", members, posts, type, status, reports, "postingLocked", "commentsDisabled", "createdAt", "memberList", "postList", "commentList", "reportedList", "moderationLog") FROM stdin;
\.


--
-- Data for Name: CommunityMessage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CommunityMessage" (id, "communityId", author, "authorUsername", text, "createdAt") FROM stdin;
\.


--
-- Data for Name: Coupon; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Coupon" (id, code, type, value, "usageLimit", "usedCount", "expiresAt", status, "createdAt") FROM stdin;
c_1	WELCOME20	percentage	20	500	0	2027-06-30 00:00:00	active	2024-01-01 00:00:00
c_2	SELLER50	fixed	50	200	0	2027-03-15 00:00:00	active	2024-03-01 00:00:00
c_3	PREMIUM25	percentage	25	100	0	2024-12-31 00:00:00	expired	2024-06-01 00:00:00
c_4	FLASH30	percentage	30	300	0	2027-02-28 00:00:00	active	2024-09-01 00:00:00
c_5	YEARLY100	fixed	100	50	0	2027-12-31 00:00:00	active	2024-11-01 00:00:00
c_6	OLD10	percentage	10	1000	0	2024-06-30 00:00:00	disabled	2023-06-01 00:00:00
\.


--
-- Data for Name: DeliveryZone; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DeliveryZone" (id, name, region, rate, eta, coverage, active) FROM stdin;
zone_1	Zone 1 - City Center	Downtown	3.5	Same day	100	t
zone_2	Zone 2 - Suburbs	Residential areas	5	1-2 days	92	t
zone_3	Zone 3 - Rural	Outlying towns	8.5	3-5 days	74	t
zone_4	Zone 4 - Remote	Far districts	12	5-7 days	51	f
\.


--
-- Data for Name: Dispute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Dispute" (id, "orderId", "buyerName", "sellerName", reason, amount, status, "raisedAt", outcome, note, "resolvedAt") FROM stdin;
\.


--
-- Data for Name: FeaturedPost; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FeaturedPost" (id, "postId", title, excerpt, "imageUrl", "position", "isPinned", status, "startDate", "endDate", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Follow; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Follow" (id, follower, followed, "createdAt") FROM stdin;
\.


--
-- Data for Name: FoodHubItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FoodHubItem" (id, title, category, price, restaurant, rating, status) FROM stdin;
\.


--
-- Data for Name: GatewayLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."GatewayLog" (id, gateway, event, amount, status, message, "createdAt") FROM stdin;
\.


--
-- Data for Name: Hashtag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Hashtag" (id, tag, "postsCount", followers, trending, status) FROM stdin;
\.


--
-- Data for Name: HomeSection; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HomeSection" (id, name, title, "isEnabled", "position") FROM stdin;
\.


--
-- Data for Name: HotDeal; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HotDeal" (id, "productId", "productName", "productImage", "originalPrice", "discountedPrice", "discountPercentage", "startDate", "endDate", priority, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: LedgerEntry; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LedgerEntry" (id, "partyName", "partyRole", direction, type, amount, method, status, "orderId", "createdAt") FROM stdin;
\.


--
-- Data for Name: LiveStream; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LiveStream" (id, title, "hostName", "hostUsername", viewers, status, "startedAt", "endedAt") FROM stdin;
\.


--
-- Data for Name: LoyaltyUser; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LoyaltyUser" (id, "userName", points, tier, referrals, "rewardsRedeemed", "joinedAt") FROM stdin;
\.


--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Message" (id, "threadId", sender, "senderRole", body, "createdAt") FROM stdin;
\.


--
-- Data for Name: NotificationHistoryItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."NotificationHistoryItem" (id, channel, title, audience, status, "scheduledFor", "sentAt") FROM stdin;
\.


--
-- Data for Name: NotificationTemplate; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."NotificationTemplate" (id, name, channel, subject, title, body, preview) FROM stdin;
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Order" (id, "buyerName", "sellerName", amount, status, "deliveryStatus", items, "itemsList", "shippingCarrier", "trackingNumber", "estimatedDelivery", "actualDelivery", "shippingAddress", "paymentMethod", "paymentStatus", "createdAt", "deliveryLog", "orderNumber", "buyerUsername", "sellerUsername", reviewed, rating, "reviewComment", "placedAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PasswordResetToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PasswordResetToken" (id, "adminId", "tokenHash", "expiresAt", "usedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: PaymentMethod; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PaymentMethod" (id, "userName", type, brand, last4, status, "addedAt") FROM stdin;
\.


--
-- Data for Name: Post; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Post" (id, title, "authorName", "authorUsername", "sellerLocation", verified, price, mrp, description, category, "subCategories", hashtags, images, type, status, likes, comments, "isSold", featured, condition, brand, variants, "stockLeft", negotiable, "listingLat", "listingLng", "listingLocation", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PostComment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PostComment" (id, "postId", author, username, "parentId", text, likes, "likedBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: PostLike; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PostLike" (id, "postId", username, "createdAt") FROM stdin;
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Product" (id, title, images, price, category, "sellerName", status, reports, "warningReason", "createdAt") FROM stdin;
\.


--
-- Data for Name: PromotionPurchase; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PromotionPurchase" (id, kind, "packageName", "amountPaid", currency, "durationDays", "sellerId", "sellerName", "sellerLogo", "productId", "productName", "productImage", "originalPrice", "discountedPrice", "postId", "postTitle", "postImage", "postExcerpt", provider, "providerPaymentId", "checkoutRef", status, "position", "isPinned", "startsAt", "endsAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: Reel; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Reel" (id, title, "creatorName", views, likes, status, "createdAt") FROM stdin;
\.


--
-- Data for Name: Refund; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Refund" (id, "orderRef", "buyerName", "sellerName", reason, amount, status, "requestedAt", "respondedAt") FROM stdin;
\.


--
-- Data for Name: ReportedComment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ReportedComment" (id, "commentId", "postTitle", "authorName", text, reason, "reportCount", "createdAt") FROM stdin;
\.


--
-- Data for Name: ReportedMessage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ReportedMessage" (id, "threadId", participants, preview, reason, severity, "reportCount", "createdAt") FROM stdin;
\.


--
-- Data for Name: ReportedProduct; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ReportedProduct" (id, "productId", title, "sellerName", reason, reporter, "reportCount", "createdAt") FROM stdin;
\.


--
-- Data for Name: ReportedUser; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ReportedUser" (id, name, email, "joinedAt", reason, reports, status, "reportDetails") FROM stdin;
\.


--
-- Data for Name: RevenueMetrics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."RevenueMetrics" (id, "monthlyRevenue", "annualRevenue", "activeSubscribers", "renewalsThisMonth", "churnRate", "revenueHistory") FROM stdin;
\.


--
-- Data for Name: Review; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Review" (id, "productName", "reviewerName", rating, text, status, "sellerRating", "buyerRating", "sellerUsername", "createdAt") FROM stdin;
\.


--
-- Data for Name: Seller; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Seller" (id, "businessName", "ownerName", logo, email, phone, address, category, "storeLat", "storeLng", "storeAddress", "taxId", "kycStatus", "gstStatus", score, "productsCount", "totalSales", rating, "reviewCount", "joinedAt", "submittedAt") FROM stdin;
app_user0001	Riya Threadz	Riya Sharma		user0001_1788694317433@susej.app	9811110001	Mumbai, India	Fashion	\N	\N	\N	PENDING-KYC	pending	pending	0	0	0	0	0	2026-09-06 14:44:22.435	2026-09-06 14:44:22.439
\.


--
-- Data for Name: SellerAuditLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SellerAuditLog" (id, "sellerId", action, "adminName", note, "timestamp") FROM stdin;
\.


--
-- Data for Name: SellerDocument; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SellerDocument" (id, "sellerId", type, label, "fileName", url, "uploadedAt", verified) FROM stdin;
\.


--
-- Data for Name: Shipment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Shipment" (id, "orderId", "buyerName", destination, carrier, "trackingNumber", status, "estimatedDelivery", "deliveredAt", items) FROM stdin;
\.


--
-- Data for Name: StorefrontBanner; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."StorefrontBanner" (id, "sellerUsername", "sellerName", title, subtitle, "ctaLabel", "imageUrl", "imageIndex", size, "position", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Story; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Story" (id, username, "creatorName", image, caption, "durationMs", overlays, "productRef", views, status, "createdAt", "expiresAt") FROM stdin;
\.


--
-- Data for Name: Subscriber; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Subscriber" (id, "userName", email, "planName", status, billing, "startedAt", "expiresAt", "cancelledAt") FROM stdin;
\.


--
-- Data for Name: SubscriptionPlan; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SubscriptionPlan" (id, name, description, badge, "monthlyPrice", "yearlyPrice", "trialDays", "billingCycle", features, limits, settings, status, "createdAt") FROM stdin;
\.


--
-- Data for Name: SupportTicket; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SupportTicket" (id, "userName", subject, priority, status, assignee, "createdAt") FROM stdin;
\.


--
-- Data for Name: TopSeller; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TopSeller" (id, "sellerId", "sellerName", "sellerLogo", "totalSales", rating, "reviewCount", "position", "isPinned", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Transaction; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Transaction" (id, "userName", type, amount, method, gateway, reference, status, "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, name, email, avatar, role, status, "joinedAt", verified, phone, username, bio, location, interests, "isSeller", "businessName", category, verification, "walletBalance", "passwordHash", "loyaltyPoints", "updatedAt") FROM stdin;
cmtpnkxrj0004xkwlifmz49ok	User 0011	user0011_1788689560300@susej.app	\N	buyer	active	2026-09-06 10:12:40.3	f	9876500011	user0011	\N	\N	\N	f	\N	\N	none	500	\N	0	2026-09-06 10:12:40.303
cmtpolykt0007xkwliomjjqgj	User 0012	user0012_1788691287624@susej.app	\N	buyer	active	2026-09-06 10:41:27.624	f	9000000012	user0012	\N	\N	\N	f	\N	\N	none	500	\N	0	2026-09-06 10:41:27.629
cmtpq561h000cxkwlu65skkez	User 0052	user0052_1788693863381@susej.app	\N	buyer	active	2026-09-06 11:24:23.381	f	919800000052	user0052	\N	\N	\N	f	\N	\N	none	600	\N	0	2026-09-06 11:24:23.742
cmtpqf6px000txkwlbgu41wi9	Test Seller	user0003_1788694330820@susej.app	\N	buyer	active	2026-09-06 11:32:10.82	f	9833330003	tester_seed	\N	Mumbai	\N	f	Test Threadz	Fashion	none	500	\N	0	2026-09-06 11:32:10.895
cmtpqhdto0011xkwlu4oc0kq1	User 0004	user0004_1788694433339@susej.app	\N	buyer	active	2026-09-06 11:33:53.339	f	9844440004	user0004	\N	\N	\N	f	\N	\N	none	500	\N	0	2026-09-06 11:33:53.34
cmtpqewe2000kxkwl532kwvz4	Riya Sharma	user0001_1788694317433@susej.app	\N	buyer	active	2026-09-06 11:31:57.433	f	9811110001	user0001	\N	Mumbai, India	\N	f	Riya Threadz	Fashion	none	500	\N	0	2026-09-06 14:41:47.302
cmtpqewjq000nxkwlnxgmyijl	User 0002	user0002_1788694317637@susej.app	\N	buyer	active	2026-09-06 11:31:57.637	f	9822220002	user0002	\N	\N	\N	f	\N	\N	none	2500	\N	0	2026-09-06 14:41:47.635
cmtpyb23j000azowl7g2maufg	G Tester	g.tester@susej.dev	\N	buyer	active	2026-09-06 15:12:55.131	f	\N	gtester	\N	\N	\N	f	\N	\N	none	500	\N	0	2026-09-06 15:12:55.135
cmtpz9rrn0000wowlj0kom6ej	Tony	numberbook999@gmail.com	\N	buyer	active	2026-09-06 15:39:54.698	f	\N	numberbook999	\N	\N	\N	f	\N	\N	none	500	\N	0	2026-09-06 15:39:54.707
cmtq0ifk60003wowl6syqihdm	Tony	tony@susej.dev	\N	buyer	active	2026-09-06 16:14:38.406	f	\N	tony		\N	\N	f	\N		none	500	69c9d38cbc985457430cdde0d3a74099:e0bd106bf7c9f3a4fabbd5441f79edfd72bb8500d405e5323cd686b24be7b645afc1af290c052afe8031f6c380a4f8bc02811e56a693b09d5142eb00ac47eac9	0	2026-09-06 16:47:25.495
\.


--
-- Data for Name: UserNotification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."UserNotification" (id, username, type, "userName", "userHandle", action, target, "targetId", read, "timestamp") FROM stdin;
\.


--
-- Data for Name: WalletTransaction; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."WalletTransaction" (id, username, title, detail, amount, ts) FROM stdin;
cmtpnkxsa0005xkwlpml61ta0	user0011	Welcome bonus	Signup credit	500	2026-09-06 10:12:40.329
cmtpolylc0008xkwlkxr3ub26	user0012	Welcome bonus	Signup credit	500	2026-09-06 10:41:27.646
cmtpq561u000dxkwlkts6w9qy	user0052	Welcome bonus	Signup credit	500	2026-09-06 11:24:23.393
cmtpq56bx000fxkwlhpbrnf0y	user0052	Wallet top-up Â· 1788693863704-d09m		100	2026-09-06 11:24:23.758
cmtpqewee000lxkwl4yiz0z0y	user0001	Welcome bonus	Signup credit	500	2026-09-06 11:31:57.445
cmtpqewk0000oxkwlw89x3kq4	user0002	Welcome bonus	Signup credit	500	2026-09-06 11:31:57.647
cmtpqewls000qxkwlmu6ocwiv	user0002	Wallet top-up Â· 1788694317696-8nro		500	2026-09-06 11:31:57.712
cmtpqf6q6000uxkwly4dwe52b	user0003	Welcome bonus	Signup credit	500	2026-09-06 11:32:10.829
cmtpqh1aa0010xkwl4dqlpumh	user0002	Wallet top-up Â· 1788694417072-s286		500	2026-09-06 11:33:37.09
cmtpqhdtv0012xkwl7xe52a08	user0004	Welcome bonus	Signup credit	500	2026-09-06 11:33:53.346
cmtpv7fw0000414wlbnmgs8j2	user0002	Wallet top-up Â· 1788702367507-ch55		500	2026-09-06 13:46:07.537
cmtpx714p0007zowlbtvhkjdv	user0002	Wallet top-up · 1788705707618-yqm9		500	2026-09-06 14:41:47.641
cmtpyb23t000bzowl12gm9vzp	gtester	Welcome bonus	Signup credit	500	2026-09-06 15:12:55.144
cmtpz9rs20001wowlshskf1k5	numberbook999	Welcome bonus	Signup credit	500	2026-09-06 15:39:54.72
cmtq0ifki0004wowlkbjxvw5m	tony	Welcome bonus	Standard welcome grant	500	2026-09-06 16:14:38.419
\.


--
-- Data for Name: WebhookEvent; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."WebhookEvent" (id, provider, "eventType", payload, signature, "processedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: Withdrawal; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Withdrawal" (id, "userName", method, amount, status, "requestedAt", "respondedAt") FROM stdin;
\.


--
-- Name: AddressBookEntry AddressBookEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AddressBookEntry"
    ADD CONSTRAINT "AddressBookEntry_pkey" PRIMARY KEY (id);


--
-- Name: Admin Admin_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Admin"
    ADD CONSTRAINT "Admin_pkey" PRIMARY KEY (id);


--
-- Name: AppSession AppSession_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AppSession"
    ADD CONSTRAINT "AppSession_pkey" PRIMARY KEY (id);


--
-- Name: AppSetting AppSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AppSetting"
    ADD CONSTRAINT "AppSetting_pkey" PRIMARY KEY (key);


--
-- Name: AuctionBid AuctionBid_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuctionBid"
    ADD CONSTRAINT "AuctionBid_pkey" PRIMARY KEY (id);


--
-- Name: Auction Auction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Auction"
    ADD CONSTRAINT "Auction_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: BlockedUser BlockedUser_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BlockedUser"
    ADD CONSTRAINT "BlockedUser_pkey" PRIMARY KEY (id);


--
-- Name: Booking Booking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_pkey" PRIMARY KEY (id);


--
-- Name: Broadcast Broadcast_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Broadcast"
    ADD CONSTRAINT "Broadcast_pkey" PRIMARY KEY (id);


--
-- Name: Bundle Bundle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Bundle"
    ADD CONSTRAINT "Bundle_pkey" PRIMARY KEY (id);


--
-- Name: Carrier Carrier_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Carrier"
    ADD CONSTRAINT "Carrier_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: ChatThread ChatThread_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ChatThread"
    ADD CONSTRAINT "ChatThread_pkey" PRIMARY KEY (id);


--
-- Name: CommissionSetting CommissionSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommissionSetting"
    ADD CONSTRAINT "CommissionSetting_pkey" PRIMARY KEY (id);


--
-- Name: CommunityMessage CommunityMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CommunityMessage"
    ADD CONSTRAINT "CommunityMessage_pkey" PRIMARY KEY (id);


--
-- Name: Community Community_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Community"
    ADD CONSTRAINT "Community_pkey" PRIMARY KEY (id);


--
-- Name: Coupon Coupon_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Coupon"
    ADD CONSTRAINT "Coupon_pkey" PRIMARY KEY (id);


--
-- Name: DeliveryZone DeliveryZone_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeliveryZone"
    ADD CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY (id);


--
-- Name: Dispute Dispute_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Dispute"
    ADD CONSTRAINT "Dispute_pkey" PRIMARY KEY (id);


--
-- Name: FeaturedPost FeaturedPost_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeaturedPost"
    ADD CONSTRAINT "FeaturedPost_pkey" PRIMARY KEY (id);


--
-- Name: Follow Follow_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Follow"
    ADD CONSTRAINT "Follow_pkey" PRIMARY KEY (id);


--
-- Name: FoodHubItem FoodHubItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FoodHubItem"
    ADD CONSTRAINT "FoodHubItem_pkey" PRIMARY KEY (id);


--
-- Name: GatewayLog GatewayLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."GatewayLog"
    ADD CONSTRAINT "GatewayLog_pkey" PRIMARY KEY (id);


--
-- Name: Hashtag Hashtag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Hashtag"
    ADD CONSTRAINT "Hashtag_pkey" PRIMARY KEY (id);


--
-- Name: HomeSection HomeSection_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HomeSection"
    ADD CONSTRAINT "HomeSection_pkey" PRIMARY KEY (id);


--
-- Name: HotDeal HotDeal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HotDeal"
    ADD CONSTRAINT "HotDeal_pkey" PRIMARY KEY (id);


--
-- Name: LedgerEntry LedgerEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY (id);


--
-- Name: LiveStream LiveStream_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LiveStream"
    ADD CONSTRAINT "LiveStream_pkey" PRIMARY KEY (id);


--
-- Name: LoyaltyUser LoyaltyUser_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LoyaltyUser"
    ADD CONSTRAINT "LoyaltyUser_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: NotificationHistoryItem NotificationHistoryItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationHistoryItem"
    ADD CONSTRAINT "NotificationHistoryItem_pkey" PRIMARY KEY (id);


--
-- Name: NotificationTemplate NotificationTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationTemplate"
    ADD CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: PasswordResetToken PasswordResetToken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY (id);


--
-- Name: PaymentMethod PaymentMethod_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PaymentMethod"
    ADD CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY (id);


--
-- Name: PostComment PostComment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PostComment"
    ADD CONSTRAINT "PostComment_pkey" PRIMARY KEY (id);


--
-- Name: PostLike PostLike_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PostLike"
    ADD CONSTRAINT "PostLike_pkey" PRIMARY KEY (id);


--
-- Name: Post Post_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Post"
    ADD CONSTRAINT "Post_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: PromotionPurchase PromotionPurchase_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PromotionPurchase"
    ADD CONSTRAINT "PromotionPurchase_pkey" PRIMARY KEY (id);


--
-- Name: Reel Reel_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Reel"
    ADD CONSTRAINT "Reel_pkey" PRIMARY KEY (id);


--
-- Name: Refund Refund_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Refund"
    ADD CONSTRAINT "Refund_pkey" PRIMARY KEY (id);


--
-- Name: ReportedComment ReportedComment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ReportedComment"
    ADD CONSTRAINT "ReportedComment_pkey" PRIMARY KEY (id);


--
-- Name: ReportedMessage ReportedMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ReportedMessage"
    ADD CONSTRAINT "ReportedMessage_pkey" PRIMARY KEY (id);


--
-- Name: ReportedProduct ReportedProduct_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ReportedProduct"
    ADD CONSTRAINT "ReportedProduct_pkey" PRIMARY KEY (id);


--
-- Name: ReportedUser ReportedUser_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ReportedUser"
    ADD CONSTRAINT "ReportedUser_pkey" PRIMARY KEY (id);


--
-- Name: RevenueMetrics RevenueMetrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RevenueMetrics"
    ADD CONSTRAINT "RevenueMetrics_pkey" PRIMARY KEY (id);


--
-- Name: Review Review_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_pkey" PRIMARY KEY (id);


--
-- Name: SellerAuditLog SellerAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerAuditLog"
    ADD CONSTRAINT "SellerAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: SellerDocument SellerDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerDocument"
    ADD CONSTRAINT "SellerDocument_pkey" PRIMARY KEY (id);


--
-- Name: Seller Seller_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Seller"
    ADD CONSTRAINT "Seller_pkey" PRIMARY KEY (id);


--
-- Name: Shipment Shipment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Shipment"
    ADD CONSTRAINT "Shipment_pkey" PRIMARY KEY (id);


--
-- Name: StorefrontBanner StorefrontBanner_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StorefrontBanner"
    ADD CONSTRAINT "StorefrontBanner_pkey" PRIMARY KEY (id);


--
-- Name: Story Story_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Story"
    ADD CONSTRAINT "Story_pkey" PRIMARY KEY (id);


--
-- Name: Subscriber Subscriber_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Subscriber"
    ADD CONSTRAINT "Subscriber_pkey" PRIMARY KEY (id);


--
-- Name: SubscriptionPlan SubscriptionPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SubscriptionPlan"
    ADD CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY (id);


--
-- Name: SupportTicket SupportTicket_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_pkey" PRIMARY KEY (id);


--
-- Name: TopSeller TopSeller_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TopSeller"
    ADD CONSTRAINT "TopSeller_pkey" PRIMARY KEY (id);


--
-- Name: Transaction Transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY (id);


--
-- Name: UserNotification UserNotification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserNotification"
    ADD CONSTRAINT "UserNotification_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WalletTransaction WalletTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY (id);


--
-- Name: WebhookEvent WebhookEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WebhookEvent"
    ADD CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY (id);


--
-- Name: Withdrawal Withdrawal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Withdrawal"
    ADD CONSTRAINT "Withdrawal_pkey" PRIMARY KEY (id);


--
-- Name: Admin_loginId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Admin_loginId_key" ON public."Admin" USING btree ("loginId");


--
-- Name: AppSession_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AppSession_token_key" ON public."AppSession" USING btree (token);


--
-- Name: AuctionBid_auctionId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuctionBid_auctionId_idx" ON public."AuctionBid" USING btree ("auctionId");


--
-- Name: AuditLog_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_action_idx" ON public."AuditLog" USING btree (action);


--
-- Name: AuditLog_adminName_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_adminName_idx" ON public."AuditLog" USING btree ("adminName");


--
-- Name: AuditLog_entity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_entity_idx" ON public."AuditLog" USING btree (entity);


--
-- Name: AuditLog_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_timestamp_idx" ON public."AuditLog" USING btree ("timestamp");


--
-- Name: Category_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Category_slug_key" ON public."Category" USING btree (slug);


--
-- Name: ChatMessage_threadId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ChatMessage_threadId_idx" ON public."ChatMessage" USING btree ("threadId");


--
-- Name: ChatThread_participantA_participantB_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ChatThread_participantA_participantB_key" ON public."ChatThread" USING btree ("participantA", "participantB");


--
-- Name: Coupon_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Coupon_code_key" ON public."Coupon" USING btree (code);


--
-- Name: Follow_followed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Follow_followed_idx" ON public."Follow" USING btree (followed);


--
-- Name: Follow_follower_followed_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Follow_follower_followed_key" ON public."Follow" USING btree (follower, followed);


--
-- Name: HomeSection_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "HomeSection_name_key" ON public."HomeSection" USING btree (name);


--
-- Name: Order_buyerUsername_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Order_buyerUsername_idx" ON public."Order" USING btree ("buyerUsername");


--
-- Name: Order_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Order_createdAt_idx" ON public."Order" USING btree ("createdAt");


--
-- Name: Order_paymentStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Order_paymentStatus_idx" ON public."Order" USING btree ("paymentStatus");


--
-- Name: Order_sellerUsername_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Order_sellerUsername_idx" ON public."Order" USING btree ("sellerUsername");


--
-- Name: Order_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Order_status_idx" ON public."Order" USING btree (status);


--
-- Name: PasswordResetToken_tokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON public."PasswordResetToken" USING btree ("tokenHash");


--
-- Name: PostComment_postId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PostComment_postId_idx" ON public."PostComment" USING btree ("postId");


--
-- Name: PostLike_postId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PostLike_postId_idx" ON public."PostLike" USING btree ("postId");


--
-- Name: PostLike_postId_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "PostLike_postId_username_key" ON public."PostLike" USING btree ("postId", username);


--
-- Name: PostLike_username_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PostLike_username_idx" ON public."PostLike" USING btree (username);


--
-- Name: Post_authorUsername_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Post_authorUsername_idx" ON public."Post" USING btree ("authorUsername");


--
-- Name: Post_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Post_category_idx" ON public."Post" USING btree (category);


--
-- Name: Post_status_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Post_status_createdAt_idx" ON public."Post" USING btree (status, "createdAt");


--
-- Name: PromotionPurchase_checkoutRef_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "PromotionPurchase_checkoutRef_key" ON public."PromotionPurchase" USING btree ("checkoutRef");


--
-- Name: PromotionPurchase_providerPaymentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "PromotionPurchase_providerPaymentId_key" ON public."PromotionPurchase" USING btree ("providerPaymentId");


--
-- Name: StorefrontBanner_sellerUsername_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "StorefrontBanner_sellerUsername_idx" ON public."StorefrontBanner" USING btree ("sellerUsername");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_joinedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_joinedAt_idx" ON public."User" USING btree ("joinedAt");


--
-- Name: User_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_phone_idx" ON public."User" USING btree (phone);


--
-- Name: User_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_status_idx" ON public."User" USING btree (status);


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: User_verification_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_verification_idx" ON public."User" USING btree (verification);


--
-- Name: WalletTransaction_ts_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WalletTransaction_ts_idx" ON public."WalletTransaction" USING btree (ts);


--
-- Name: WalletTransaction_username_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WalletTransaction_username_idx" ON public."WalletTransaction" USING btree (username);


--
-- Name: AppSession AppSession_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AppSession"
    ADD CONSTRAINT "AppSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Category Category_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PasswordResetToken PasswordResetToken_adminId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES public."Admin"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SellerAuditLog SellerAuditLog_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerAuditLog"
    ADD CONSTRAINT "SellerAuditLog_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."Seller"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SellerDocument SellerDocument_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerDocument"
    ADD CONSTRAINT "SellerDocument_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."Seller"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

