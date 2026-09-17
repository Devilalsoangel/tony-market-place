INSERT INTO "User" (id, phone, name, "createdAt") VALUES ('probe_write_test','9800000000','Probe', now()) ON CONFLICT (id) DO NOTHING;
SELECT count(*) AS user_count FROM "User";
SELECT id, phone, "walletBalance" FROM "User" ORDER BY "createdAt" DESC LIMIT 3;