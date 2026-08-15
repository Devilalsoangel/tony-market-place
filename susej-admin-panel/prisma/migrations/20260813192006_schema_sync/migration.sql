-- CreateTable
CREATE TABLE "PromotionPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "amountPaid" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "durationDays" INTEGER NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerLogo" TEXT,
    "productId" TEXT,
    "productName" TEXT,
    "productImage" TEXT,
    "originalPrice" REAL,
    "discountedPrice" REAL,
    "postId" TEXT,
    "postTitle" TEXT,
    "postImage" TEXT,
    "postExcerpt" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'dev',
    "providerPaymentId" TEXT,
    "checkoutRef" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "position" INTEGER,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Seller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "kycStatus" TEXT NOT NULL,
    "gstStatus" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "productsCount" INTEGER NOT NULL,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 4.5,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME NOT NULL
);
INSERT INTO "new_Seller" ("address", "businessName", "email", "gstStatus", "id", "joinedAt", "kycStatus", "logo", "ownerName", "phone", "productsCount", "score", "submittedAt", "taxId") SELECT "address", "businessName", "email", "gstStatus", "id", "joinedAt", "kycStatus", "logo", "ownerName", "phone", "productsCount", "score", "submittedAt", "taxId" FROM "Seller";
DROP TABLE "Seller";
ALTER TABLE "new_Seller" RENAME TO "Seller";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PromotionPurchase_providerPaymentId_key" ON "PromotionPurchase"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionPurchase_checkoutRef_key" ON "PromotionPurchase"("checkoutRef");
