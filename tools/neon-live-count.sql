SELECT
  (SELECT count(*) FROM public."Seller") sellers,
  (SELECT count(*) FROM public."Review") reviews,
  (SELECT count(*) FROM public."Follow") follows,
  (SELECT count(*) FROM public."Product") products,
  (SELECT count(*) FROM public."Order") orders;