/**
 * Wipe all USER-owned data from Postgres — infrastructure reset only.
 * Platform config/content is KEPT: Category, Community rows, Carrier,
 * DeliveryZone, Coupon, AppSetting, CommissionSetting, Hashtag (counts
 * reset), Broadcast, FoodHubItem, HeroBanner, HomeSection, FeaturedCategory,
 * NotificationTemplate, SubscriptionPlan, Admin, AuditLog.
 *
 * Run: npx tsx wipe-users.ts   (with DATABASE_URL set)
 */
import { getPrisma } from "../src/lib/db";

const prismaPromise = getPrisma();
async function main() {
  const prisma = await prismaPromise;
  if (!prisma) throw new Error("Database unavailable");
  // Children first (FK order)
  const pass1 = [
    "chatMessage", "postLike", "postComment", "follow", "walletTransaction",
    "userNotification", "auctionBid", "communityMessage", "appSession",
    "review", "order", "post", "product",
    "sellerDocument", "sellerAuditLog", "seller",
    "reportedUser", "reportedProduct", "reportedMessage", "reportedComment",
    "blockedUser", "addressBookEntry", "paymentMethod", "transaction",
    "ledgerEntry", "gatewayLog", "shipment", "supportTicket", "message",
    "refund", "withdrawal", "dispute", "booking", "loyaltyUser",
    "promotionPurchase", "subscriber", "topSeller", "hotDeal", "featuredPost",
    "liveStream", "reel", "story", "bundle",
  ] as const;

  for (const model of pass1) {
    try {
      const r = await (prisma as any)[model].deleteMany({});
      console.log(`deleted ${model}: ${r.count}`);
    } catch (e: any) {
      console.log(`SKIP ${model}: ${e.message?.slice(0, 80)}`);
    }
  }

  // Aggregate resets so counts are truthful before the flow replay
  const tags = await prisma.hashtag.updateMany({ data: { followers: 0 } });
  console.log(`hashtag counts reset: ${tags.count}`);
  const comms = await prisma.community.findMany({ select: { id: true } });
  for (const c of comms) {
    await prisma.community.update({
      where: { id: c.id },
      data: { memberList: [] as never, members: 0, posts: 0 },
    });
  }
  console.log(`communities reset: ${comms.length}`);

  const users = await prisma.user.deleteMany({});
  console.log(`deleted user: ${users.count}`);

  const remain = await prisma.user.count();
  console.log(`USERS REMAINING: ${remain}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prismaPromise.then((p) => p?.$disconnect()));
