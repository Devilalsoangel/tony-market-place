import { randomBytes, scryptSync } from "node:crypto";
import type { Prisma } from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/db";
import {
  mockKPIs,
  mockAdmins,
  mockUsers,
  mockSellers,
  mockCategories,
  mockProducts,
  mockOrders,
  mockCommunities,
  mockReviews,
  mockTransactions,
  mockLedger,
  mockGatewayLogs,
  mockCarriers,
  mockDeliveryZones,
  mockTickets,
  mockAuditLogs,
  mockPromotions,
  mockCoupons,
  mockRevenueMetrics,
  mockNotificationTemplates,
  mockNotificationHistory,
  mockTopCategories,
  mockGrowthData,
  mockReportedUsers,
  mockReportedProducts,
  mockReportedMessages,
  mockReportedComments,
  mockFeedPosts,
  mockBlockedUsers,
  mockAddressBook,
  mockPaymentMethods,
  mockLiveStreams,
  mockReels,
  mockStories,
  mockHashtags,
  mockBundles,
  mockFoodHub,
  mockBroadcasts,
  mockBookings,
  mockLoyaltyUsers,
  mockDisputes,
  mockAuctionRows,
  mockRefundRequests,
  mockWithdrawalRequests,
  mockCommissionSettings,
} from "../src/services/mock-data";
import {
  mockHeroBanners,
  mockFeaturedCategories,
  mockTopSellers,
  mockHotDeals,
  mockFeaturedPosts,
  mockLayout,
} from "../src/home-management/lib/mockData";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function toDate(value: string | number | Date | undefined | null): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (!value) return new Date();
  const t = Date.parse(value);
  return Number.isNaN(t) ? new Date() : new Date(t);
}

function toOptionalDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t);
}

function jx<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

async function main() {
  const prisma = await getPrisma();
  if (!prisma) {
    throw new Error("Database unavailable - cannot seed.");
  }
  console.log("Resetting existing data...");
  await prisma.$transaction([
    prisma.sellerDocument.deleteMany(),
    prisma.sellerAuditLog.deleteMany(),
    prisma.seller.deleteMany(),
    prisma.category.deleteMany(),
    prisma.product.deleteMany(),
    prisma.order.deleteMany(),
    prisma.community.deleteMany(),
    prisma.review.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.ledgerEntry.deleteMany(),
    prisma.gatewayLog.deleteMany(),
    prisma.shipment.deleteMany(),
    prisma.carrier.deleteMany(),
    prisma.deliveryZone.deleteMany(),
    prisma.supportTicket.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.notificationTemplate.deleteMany(),
    prisma.notificationHistoryItem.deleteMany(),
    prisma.subscriptionPlan.deleteMany(),
    prisma.subscriber.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.heroBanner.deleteMany(),
    prisma.featuredCategory.deleteMany(),
    prisma.topSeller.deleteMany(),
    prisma.hotDeal.deleteMany(),
    prisma.featuredPost.deleteMany(),
    prisma.homeSection.deleteMany(),
    prisma.appSetting.deleteMany(),
    prisma.revenueMetrics.deleteMany(),
    prisma.reportedUser.deleteMany(),
    prisma.reportedProduct.deleteMany(),
    prisma.reportedMessage.deleteMany(),
    prisma.reportedComment.deleteMany(),
    prisma.post.deleteMany(),
    prisma.blockedUser.deleteMany(),
    prisma.addressBookEntry.deleteMany(),
    prisma.paymentMethod.deleteMany(),
    prisma.liveStream.deleteMany(),
    prisma.reel.deleteMany(),
    prisma.story.deleteMany(),
    prisma.hashtag.deleteMany(),
    prisma.bundle.deleteMany(),
    prisma.foodHubItem.deleteMany(),
    prisma.broadcast.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.loyaltyUser.deleteMany(),
    prisma.dispute.deleteMany(),
    prisma.auction.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.withdrawal.deleteMany(),
    prisma.commissionSetting.deleteMany(),
    prisma.message.deleteMany(),
    prisma.promotionPurchase.deleteMany(),
    prisma.webhookEvent.deleteMany(),
  ]);

  console.log("Seeding database...");
  console.log("sellers after wipe:", await prisma.seller.count());

  for (const a of mockAdmins) {
    const twoFactorEnabled = a.loginId === "alexrivera";
    await prisma.admin.upsert({
      where: { id: a.id },
      update: {
        lastLogin: toOptionalDate(a.lastLogin),
        twoFactorEnabled,
        twoFactorCode: twoFactorEnabled ? hashPassword("123456") : null,
      },
      create: {
        id: a.id,
        name: a.name,
        loginId: a.loginId,
        email: a.email,
        passwordHash: hashPassword(a.password ?? "Admin@123"),
        role: a.role,
        status: a.status,
        twoFactorEnabled,
        twoFactorCode: twoFactorEnabled ? hashPassword("123456") : null,
        createdAt: toDate("2024-01-01"),
        lastLogin: toOptionalDate(a.lastLogin),
      },
    });
  }
  console.log(`admins: ${mockAdmins.length}`);

  for (const [i, u] of mockUsers.entries()) {
    const [local, domain] = u.email.split("@");
    const email = `${local}${i + 1}@${domain}`;
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        name: u.name,
        email,
        role: u.role,
        status: u.status,
        verified: u.verified,
        joinedAt: toDate(u.joinedAt),
      },
    });
  }
  console.log(`users: ${mockUsers.length}`);

  for (const s of mockSellers) {
    await prisma.seller.create({
      data: {
        id: s.id,
        businessName: s.businessName,
        ownerName: s.ownerName,
        logo: s.logo,
        email: s.email,
        phone: s.phone,
        address: s.address,
        taxId: s.taxId,
        kycStatus: s.kycStatus,
        gstStatus: s.gstStatus,
        score: s.score,
        productsCount: s.productsCount,
        joinedAt: toDate(s.joinedAt),
        submittedAt: toDate(s.submittedAt),
        documents: {
          create: s.documents.map((d) => ({
            id: `${s.id}_${d.id}`,
            type: d.type,
            label: d.label,
            fileName: d.fileName,
            url: d.url,
            uploadedAt: toDate(d.uploadedAt),
            verified: d.verified,
          })),
        },
        auditLogs: {
          create: s.auditLogs.map((a) => ({
            id: a.id,
            action: a.action,
            adminName: a.adminName,
            note: a.note,
            timestamp: toDate(a.timestamp),
          })),
        },
      },
    });
  }
  console.log(`sellers: ${mockSellers.length}`);

  for (const c of mockCategories) {
    await prisma.category.create({
      data: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        parentId: c.parentId,
        sortOrder: c.sortOrder,
        icon: c.icon,
        bannerImage: c.bannerImage,
        status: c.status,
        featured: c.featured,
        productCount: c.productCount,
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
        createdAt: toDate(c.createdAt),
      },
    });
  }
  console.log(`categories: ${mockCategories.length}`);

  for (const p of mockProducts) {
    await prisma.product.create({
      data: {
        id: p.id,
        title: p.title,
        images: jx(p.images),
        price: p.price,
        category: p.category,
        sellerName: p.sellerName,
        status: p.status,
        reports: p.reports,
        createdAt: toDate(p.createdAt),
      },
    });
  }
  console.log(`products: ${mockProducts.length}`);

  for (const o of mockOrders) {
    await prisma.order.upsert({
      where: { id: o.id },
      update: {},
      create: {
        id: o.id,
        buyerName: o.buyerName,
        sellerName: o.sellerName,
        amount: o.amount,
        status: o.status,
        deliveryStatus: o.deliveryStatus,
        items: o.items,
        itemsList: jx(o.itemsList),
        shippingCarrier: o.shippingCarrier,
        trackingNumber: o.trackingNumber ?? "",
        estimatedDelivery: o.estimatedDelivery ?? "",
        actualDelivery: o.actualDelivery ?? "",
        shippingAddress: o.shippingAddress,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        deliveryLog: jx(o.deliveryLog),
        createdAt: toDate(o.createdAt),
      },
    });
  }
  console.log(`orders: ${mockOrders.length}`);

  for (const c of mockCommunities) {
    await prisma.community.create({
      data: {
        id: c.id,
        name: c.name,
        description: c.description,
        ownerName: c.ownerName,
        members: c.members,
        posts: c.posts,
        type: c.type,
        status: c.status,
        reports: c.reports,
        postingLocked: c.postingLocked,
        commentsDisabled: c.commentsDisabled,
        createdAt: toDate(c.createdAt),
        memberList: jx(c.memberList),
        postList: jx(c.postList),
        commentList: jx(c.commentList),
        reportedList: jx(c.reportedList),
        moderationLog: jx(c.moderationLog),
      },
    });
  }
  console.log(`communities: ${mockCommunities.length}`);

  for (const r of mockReviews) {
    await prisma.review.create({
      data: {
        id: r.id,
        productName: r.productName,
        reviewerName: r.reviewerName,
        rating: r.rating,
        text: r.text,
        status: r.status,
        sellerRating: r.sellerRating ?? null,
        buyerRating: r.buyerRating ?? null,
      },
    });
  }
  console.log(`reviews: ${mockReviews.length}`);

  for (const t of mockTransactions) {
    await prisma.transaction.create({
      data: {
        id: t.id,
        userName: t.userName,
        type: t.type,
        amount: t.amount,
        method: t.method,
        gateway: t.gateway,
        reference: t.reference,
        status: t.status,
        createdAt: toDate(t.createdAt),
      },
    });
  }
  console.log(`transactions: ${mockTransactions.length}`);

  for (const l of mockLedger) {
    await prisma.ledgerEntry.create({
      data: {
        id: l.id,
        partyName: l.partyName,
        partyRole: l.partyRole,
        direction: l.direction,
        type: l.type,
        amount: l.amount,
        method: l.method,
        status: l.status,
        orderId: l.orderId,
        createdAt: toDate(l.createdAt),
      },
    });
  }
  console.log(`ledger entries: ${mockLedger.length}`);

  for (const g of mockGatewayLogs) {
    await prisma.gatewayLog.create({
      data: {
        id: g.id,
        gateway: g.gateway,
        event: g.event,
        amount: g.amount,
        status: g.status,
        message: g.message,
        createdAt: toDate(g.createdAt),
      },
    });
  }
  console.log(`gateway logs: ${mockGatewayLogs.length}`);

  const shipmentCount = mockOrders.filter((o) =>
    ["awaiting_shipment", "packed", "shipped", "out_for_delivery", "delivered", "delivery_failed", "returned"].includes(o.deliveryStatus)
  ).slice(0, 14);
  for (const [i, o] of shipmentCount.entries()) {
    await prisma.shipment.create({
      data: {
        id: `SHIP-${String(2000 + i).padStart(4, "0")}`,
        orderId: o.id,
        buyerName: o.buyerName,
        destination: o.shippingAddress,
        carrier: o.shippingCarrier,
        trackingNumber: o.trackingNumber ?? "",
        status: o.deliveryStatus,
        estimatedDelivery: o.estimatedDelivery ?? "",
        deliveredAt: o.actualDelivery ?? "",
        items: o.items,
      },
    });
  }
  console.log(`shipments: ${shipmentCount.length}`);

  for (const c of mockCarriers) {
    await prisma.carrier.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }
  console.log(`carriers: ${mockCarriers.length}`);

  for (const z of mockDeliveryZones) {
    await prisma.deliveryZone.upsert({
      where: { id: z.id },
      update: {},
      create: z,
    });
  }
  console.log(`delivery zones: ${mockDeliveryZones.length}`);

  for (const t of mockTickets) {
    await prisma.supportTicket.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        userName: t.userName,
        subject: t.subject,
        priority: t.priority,
        status: t.status,
        assignee: t.assignee,
        createdAt: toDate(t.createdAt),
      },
    });
    // persisted conversation thread for the ticket
    const openers = [
      `Hi, I need help with: ${t.subject.toLowerCase()}. Please assist as soon as possible.`,
      "Thanks for reaching out! We have received your ticket and are looking into it.",
      "I can share more details if needed. Let me know what you require.",
    ];
    const base = toDate(t.createdAt).getTime();
    for (let i = 0; i < openers.length; i++) {
      await prisma.message.create({
        data: {
          id: `msg_tk_${t.id}_${i}`,
          threadId: t.id,
          sender: i % 2 === 0 ? t.userName : "Support Agent",
          senderRole: i % 2 === 0 ? "user" : "agent",
          body: openers[i],
          createdAt: new Date(base + i * 90 * 60 * 1000),
        },
      });
    }
  }
  console.log(`tickets: ${mockTickets.length} (with threads)`);

  // Live-chat threads (threadId = lc_<user-id>)
  const liveThreads: { threadId: string; sender: string; senderRole: string; body: string; minsAgo: number }[] = [
    { threadId: "lc_u1", sender: "Alice Johnson", senderRole: "user", body: "Hi, I need help with my order #ORD-1001", minsAgo: 95 },
    { threadId: "lc_u1", sender: "Support Agent", senderRole: "agent", body: "Hello Alice! I'd be happy to help. What seems to be the issue?", minsAgo: 94 },
    { threadId: "lc_u1", sender: "Alice Johnson", senderRole: "user", body: "The package hasn't arrived yet and it's been 2 weeks", minsAgo: 93 },
    { threadId: "lc_u1", sender: "Support Agent", senderRole: "agent", body: "Let me check the tracking details for you. One moment please.", minsAgo: 92 },
    { threadId: "lc_u3", sender: "Charlie Lee", senderRole: "user", body: "My payment of $129 is stuck on pending", minsAgo: 130 },
    { threadId: "lc_u3", sender: "Support Agent", senderRole: "agent", body: "I can see the transaction. Let me escalate this to the payments team.", minsAgo: 125 },
    { threadId: "lc_u5", sender: "Eve Chen", senderRole: "user", body: "How do I become a seller on SUSEJ?", minsAgo: 45 },
  ];
  for (const [i, m] of liveThreads.entries()) {
    await prisma.message.create({
      data: {
        id: `msg_lc_${i}`,
        threadId: m.threadId,
        sender: m.sender,
        senderRole: m.senderRole,
        body: m.body,
        createdAt: new Date(Date.now() - m.minsAgo * 60 * 1000),
      },
    });
  }
  console.log(`live chat threads: ${liveThreads.length} messages`);

  for (const a of mockAuditLogs) {
    await prisma.auditLog.create({
      data: {
        id: a.id,
        adminName: a.adminName,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        details: a.details,
        ip: a.ip,
        timestamp: toDate(a.timestamp),
      },
    });
  }
  console.log(`audit logs: ${mockAuditLogs.length}`);

  for (const t of mockNotificationTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        name: t.name,
        channel: t.channel,
        subject: t.subject,
        title: t.title,
        body: t.body,
        preview: t.preview,
      },
    });
  }
  console.log(`notification templates: ${mockNotificationTemplates.length}`);

  for (const h of mockNotificationHistory) {
    await prisma.notificationHistoryItem.create({
      data: {
        id: h.id,
        channel: h.channel,
        title: h.title,
        audience: h.audience,
        status: h.status,
        scheduledFor: h.scheduledFor,
        sentAt: toOptionalDate(h.sentAt),
      },
    });
  }
  console.log(`notification history: ${mockNotificationHistory.length}`);

  for (const p of mockPromotions) {
    await prisma.promotionPurchase.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        kind: p.kind,
        packageName: p.packageName,
        amountPaid: p.amountPaid,
        currency: p.currency,
        durationDays: p.durationDays,
        sellerId: p.sellerId,
        sellerName: p.sellerName,
        sellerLogo: p.sellerLogo,
        productId: p.productId,
        productName: p.productName,
        productImage: p.productImage,
        postId: p.postId,
        postTitle: p.postTitle,
        postImage: p.postImage,
        provider: "dev",
        checkoutRef: `${p.id}-checkout`,
        status: p.status,
        position: p.position,
        isPinned: p.isPinned,
        startsAt: toOptionalDate(p.startsAt),
        endsAt: toOptionalDate(p.endsAt),
        createdAt: toDate(p.createdAt),
      },
    });
  }
  console.log(`promotions: ${mockPromotions.length}`);

  for (const c of mockCoupons) {
    await prisma.coupon.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        code: c.code,
        type: c.type,
        value: c.value,
        usageLimit: c.usageLimit,
        usedCount: c.usedCount,
        expiresAt: toDate(c.expiresAt),
        status: c.status,
        createdAt: toDate(c.createdAt),
      },
    });
  }
  console.log(`coupons: ${mockCoupons.length}`);

  await prisma.revenueMetrics.upsert({
    where: { id: "metrics" },
    update: {},
    create: {
      id: "metrics",
      monthlyRevenue: mockRevenueMetrics.monthlyRevenue,
      annualRevenue: mockRevenueMetrics.annualRevenue,
      activeSubscribers: mockRevenueMetrics.activeSubscribers,
      renewalsThisMonth: mockRevenueMetrics.renewalsThisMonth,
      churnRate: mockRevenueMetrics.churnRate,
      revenueHistory: jx(mockRevenueMetrics.revenueHistory),
    },
  });
  console.log("revenue metrics: 1");

  await prisma.appSetting.createMany({
    data: [
      { key: "siteName", value: "SUSEJ Marketplace" },
      { key: "defaultLanguage", value: "en" },
      { key: "currency", value: "usd" },
      { key: "timezone", value: "utc" },
      { key: "supportEmail", value: "support@susej.com" },
      { key: "platformRatePercent", value: 2.9 },
      { key: "kpis", value: jx(mockKPIs) },
      { key: "growthData", value: jx(mockGrowthData) },
      { key: "topCategories", value: jx(mockTopCategories) },
      { key: "revenueData", value: jx([
        { month: "Jan", revenue: 185000, orders: 4200 },
        { month: "Feb", revenue: 210000, orders: 4800 },
        { month: "Mar", revenue: 195000, orders: 4500 },
        { month: "Apr", revenue: 240000, orders: 5100 },
        { month: "May", revenue: 225000, orders: 4900 },
        { month: "Jun", revenue: 284500, orders: 5600 },
      ]) },
    ],
  });
  console.log("app settings: 10");

  for (const b of mockHeroBanners) {
    await prisma.heroBanner.upsert({
      where: { id: b.id },
      update: {},
      create: {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl,
        buttonText: b.buttonText,
        buttonAction: b.buttonAction,
        destinationId: b.destinationId,
        destinationUrl: b.destinationUrl,
        startDate: b.startDate,
        endDate: b.endDate,
        status: b.status,
        createdAt: toDate(b.createdAt),
      },
    });
  }
  console.log(`hero banners: ${mockHeroBanners.length}`);

  for (const f of mockFeaturedCategories) {
    await prisma.featuredCategory.upsert({
      where: { id: f.id },
      update: {},
      create: {
        id: f.id,
        categoryId: f.categoryId,
        categoryName: f.categoryName,
        imageUrl: f.imageUrl,
        position: f.position,
        status: f.status,
        createdAt: toDate(f.createdAt),
      },
    });
  }
  console.log(`featured categories: ${mockFeaturedCategories.length}`);

  for (const t of mockTopSellers) {
    await prisma.topSeller.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        sellerId: t.sellerId,
        sellerName: t.sellerName,
        sellerLogo: t.sellerLogo,
        totalSales: t.totalSales,
        rating: t.rating,
        reviewCount: t.reviewCount,
        position: t.position,
        isPinned: t.isPinned,
        status: t.status,
        createdAt: toDate(t.createdAt),
      },
    });
  }
  console.log(`top sellers: ${mockTopSellers.length}`);

  for (const d of mockHotDeals) {
    await prisma.hotDeal.upsert({
      where: { id: d.id },
      update: {},
      create: {
        id: d.id,
        productId: d.productId,
        productName: d.productName,
        productImage: d.productImage,
        originalPrice: d.originalPrice,
        discountedPrice: d.discountedPrice,
        discountPercentage: d.discountPercentage,
        startDate: d.startDate,
        endDate: d.endDate,
        priority: d.priority,
        status: d.status,
        createdAt: toDate(d.createdAt),
      },
    });
  }
  console.log(`hot deals: ${mockHotDeals.length}`);

  for (const f of mockFeaturedPosts) {
    await prisma.featuredPost.upsert({
      where: { id: f.id },
      update: {},
      create: {
        id: f.id,
        postId: f.postId,
        title: f.title,
        excerpt: f.excerpt,
        imageUrl: f.imageUrl,
        position: f.position,
        isPinned: f.isPinned,
        status: f.status,
        startDate: f.startDate ?? "",
        endDate: f.endDate ?? "",
        createdAt: toDate(f.createdAt),
      },
    });
  }
  console.log(`featured posts (home): ${mockFeaturedPosts.length}`);

  for (const s of mockLayout) {
    await prisma.homeSection.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        name: s.name,
        title: s.title,
        isEnabled: s.isEnabled,
        position: s.position,
      },
    });
  }
  console.log(`home sections: ${mockLayout.length}`);

  // ---- Extended moderation / operations resources ----

  for (const r of mockReportedUsers) {
    await prisma.reportedUser.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        name: r.name,
        email: r.email,
        joinedAt: r.joinedAt,
        reason: r.reason,
        reports: r.reports,
        status: r.status,
        reportDetails: jx(r.reportDetails),
      },
    });
  }
  console.log(`reported users: ${mockReportedUsers.length}`);

  for (const r of mockReportedProducts) {
    await prisma.reportedProduct.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        productId: r.productId,
        title: r.title,
        sellerName: r.sellerName,
        reason: r.reason,
        reporter: r.reporter,
        reportCount: r.reportCount,
        createdAt: toDate(r.createdAt),
      },
    });
  }
  console.log(`reported products: ${mockReportedProducts.length}`);

  for (const r of mockReportedMessages) {
    await prisma.reportedMessage.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        threadId: r.threadId,
        participants: r.participants,
        preview: r.preview,
        reason: r.reason,
        severity: r.severity,
        reportCount: r.reportCount,
        createdAt: toDate(r.createdAt),
      },
    });
  }
  console.log(`reported messages: ${mockReportedMessages.length}`);

  for (const r of mockReportedComments) {
    await prisma.reportedComment.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        commentId: r.commentId,
        postTitle: r.postTitle,
        authorName: r.authorName,
        text: r.text,
        reason: r.reason,
        reportCount: r.reportCount,
        createdAt: toDate(r.createdAt),
      },
    });
  }
  console.log(`reported comments: ${mockReportedComments.length}`);

  for (const p of mockFeedPosts) {
    await prisma.post.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        title: p.title,
        authorName: p.authorName,
        type: p.type,
        status: p.status,
        likes: p.likes,
        comments: p.comments,
        createdAt: toDate(p.createdAt),
      },
    });
  }
  console.log(`posts: ${mockFeedPosts.length}`);

  for (const b of mockBlockedUsers) {
    await prisma.blockedUser.upsert({
      where: { id: b.id },
      update: {},
      create: {
        id: b.id,
        userName: b.userName,
        email: b.email,
        reason: b.reason,
        bannedBy: b.bannedBy,
        bannedAt: toDate(b.bannedAt),
        kind: b.kind,
      },
    });
  }
  console.log(`blocked users: ${mockBlockedUsers.length}`);

  for (const a of mockAddressBook) {
    await prisma.addressBookEntry.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        userName: a.userName,
        label: a.label,
        address: a.address,
        city: a.city,
        phone: a.phone,
        isDefault: a.isDefault,
      },
    });
  }
  console.log(`address book: ${mockAddressBook.length}`);

  for (const p of mockPaymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        userName: p.userName,
        type: p.type,
        brand: p.brand,
        last4: p.last4,
        status: p.status,
        addedAt: toDate(p.addedAt),
      },
    });
  }
  console.log(`payment methods: ${mockPaymentMethods.length}`);

  for (const l of mockLiveStreams) {
    await prisma.liveStream.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        title: l.title,
        hostName: l.hostName,
        viewers: l.viewers,
        status: l.status,
        startedAt: toDate(l.startedAt),
      },
    });
  }
  console.log(`live streams: ${mockLiveStreams.length}`);

  for (const r of mockReels) {
    await prisma.reel.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        title: r.title,
        creatorName: r.creatorName,
        views: r.views,
        likes: r.likes,
        status: r.status,
        createdAt: toDate(r.createdAt),
      },
    });
  }
  console.log(`reels: ${mockReels.length}`);

  for (const s of mockStories) {
    await prisma.story.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        creatorName: s.creatorName,
        views: s.views,
        status: s.status,
        createdAt: toDate(s.createdAt),
      },
    });
  }
  console.log(`stories: ${mockStories.length}`);

  for (const h of mockHashtags) {
    await prisma.hashtag.upsert({
      where: { id: h.id },
      update: {},
      create: {
        id: h.id,
        tag: h.tag,
        postsCount: h.postsCount,
        followers: h.followers,
        trending: h.trending,
        status: h.status,
      },
    });
  }
  console.log(`hashtags: ${mockHashtags.length}`);

  for (const b of mockBundles) {
    await prisma.bundle.upsert({
      where: { id: b.id },
      update: {},
      create: {
        id: b.id,
        title: b.title,
        itemsCount: b.itemsCount,
        price: b.price,
        discount: b.discount,
        sellerName: b.sellerName,
        status: b.status,
        createdAt: toDate(b.createdAt),
      },
    });
  }
  console.log(`bundles: ${mockBundles.length}`);

  for (const f of mockFoodHub) {
    await prisma.foodHubItem.upsert({
      where: { id: f.id },
      update: {},
      create: {
        id: f.id,
        title: f.title,
        category: f.category,
        price: f.price,
        restaurant: f.restaurant,
        rating: f.rating,
        status: f.status,
      },
    });
  }
  console.log(`food hub: ${mockFoodHub.length}`);

  for (const b of mockBroadcasts) {
    await prisma.broadcast.upsert({
      where: { id: b.id },
      update: {},
      create: {
        id: b.id,
        title: b.title,
        hostName: b.hostName,
        listeners: b.listeners,
        status: b.status,
        scheduledAt: toDate(b.scheduledAt),
      },
    });
  }
  console.log(`broadcasts: ${mockBroadcasts.length}`);

  for (const b of mockBookings) {
    await prisma.booking.upsert({
      where: { id: b.id },
      update: {},
      create: {
        id: b.id,
        serviceName: b.serviceName,
        customerName: b.customerName,
        sellerName: b.sellerName,
        date: b.date,
        time: b.time,
        price: b.price,
        status: b.status,
      },
    });
  }
  console.log(`bookings: ${mockBookings.length}`);

  for (const l of mockLoyaltyUsers) {
    await prisma.loyaltyUser.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        userName: l.userName,
        points: l.points,
        tier: l.tier,
        referrals: l.referrals,
        rewardsRedeemed: l.rewardsRedeemed,
        joinedAt: toDate(l.joinedAt),
      },
    });
  }
  console.log(`loyalty users: ${mockLoyaltyUsers.length}`);

  for (const d of mockDisputes) {
    await prisma.dispute.upsert({
      where: { id: d.id },
      update: {},
      create: {
        id: d.id,
        orderId: d.orderId,
        buyerName: d.buyerName,
        sellerName: d.sellerName,
        reason: d.reason,
        amount: d.amount,
        status: d.status,
        raisedAt: toDate(d.raisedAt),
        outcome: d.outcome ?? null,
        note: d.note ?? null,
        resolvedAt: d.resolvedAt ? toDate(d.resolvedAt) : null,
      },
    });
  }
  console.log(`disputes: ${mockDisputes.length}`);

  for (const a of mockAuctionRows) {
    await prisma.auction.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        title: a.title,
        status: a.status,
        currentBid: a.currentBid,
        endsAt: toDate(a.endsAt),
        bids: a.bids,
        sellerName: a.sellerName,
        sellerUsername: a.sellerUsername,
      },
    });
  }
  console.log(`auctions: ${mockAuctionRows.length}`);

  for (const r of mockRefundRequests) {
    await prisma.refund.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        orderRef: r.orderRef,
        buyerName: r.buyerName,
        sellerName: r.sellerName,
        reason: r.reason,
        amount: r.amount,
        status: r.status,
        requestedAt: toDate(r.requestedAt),
        respondedAt: r.respondedAt ? toDate(r.respondedAt) : null,
      },
    });
  }
  console.log(`refunds: ${mockRefundRequests.length}`);

  for (const w of mockWithdrawalRequests) {
    await prisma.withdrawal.upsert({
      where: { id: w.id },
      update: {},
      create: {
        id: w.id,
        userName: w.userName,
        method: w.method,
        amount: w.amount,
        status: w.status,
        requestedAt: toDate(w.requestedAt),
        respondedAt: w.respondedAt ? toDate(w.respondedAt) : null,
      },
    });
  }
  console.log(`withdrawals: ${mockWithdrawalRequests.length}`);

  await prisma.commissionSetting.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      commissionRate: mockCommissionSettings.commissionRate,
      listingFee: mockCommissionSettings.listingFee,
      payoutFee: mockCommissionSettings.payoutFee,
      categoryOverrides: jx(mockCommissionSettings.categoryOverrides),
    },
  });
  console.log("commission settings: 1");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = await getPrisma();
    if (prisma) await prisma.$disconnect();
  });