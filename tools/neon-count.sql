SELECT
  (SELECT count(*) FROM public."User") users,
  (SELECT count(*) FROM public."Admin") admins,
  (SELECT count(*) FROM public."Post") posts,
  (SELECT count(*) FROM public."Order") orders,
  (SELECT count(*) FROM public."Category") categories,
  (SELECT count(*) FROM public."Product") products;