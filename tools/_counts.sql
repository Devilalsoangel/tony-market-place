SELECT
  (SELECT count(*) FROM "User") AS users,
  (SELECT count(*) FROM "Admin") AS admins,
  (SELECT count(*) FROM "Seller") AS sellers,
  (SELECT count(*) FROM "Post") AS posts,
  (SELECT count(*) FROM "Product") AS products;