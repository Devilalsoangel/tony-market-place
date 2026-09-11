-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FeaturedPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isPinned" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TEXT NOT NULL DEFAULT '',
    "endDate" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FeaturedPost" ("createdAt", "excerpt", "id", "imageUrl", "isPinned", "position", "postId", "status", "title", "updatedAt") SELECT "createdAt", "excerpt", "id", "imageUrl", "isPinned", "position", "postId", "status", "title", "updatedAt" FROM "FeaturedPost";
DROP TABLE "FeaturedPost";
ALTER TABLE "new_FeaturedPost" RENAME TO "FeaturedPost";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
