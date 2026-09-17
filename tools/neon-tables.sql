SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;
SELECT
  (SELECT COUNT(*) FROM "Admin") AS admins,
  (SELECT COUNT(*) FROM "User") AS prisma_users,
  (SELECT COUNT(*) FROM users) AS api_users;