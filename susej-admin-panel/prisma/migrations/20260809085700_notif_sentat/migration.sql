-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotificationHistoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scheduledFor" TEXT,
    "sentAt" DATETIME
);
INSERT INTO "new_NotificationHistoryItem" ("audience", "channel", "id", "scheduledFor", "sentAt", "status", "title") SELECT "audience", "channel", "id", "scheduledFor", "sentAt", "status", "title" FROM "NotificationHistoryItem";
DROP TABLE "NotificationHistoryItem";
ALTER TABLE "new_NotificationHistoryItem" RENAME TO "NotificationHistoryItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
