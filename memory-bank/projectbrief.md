# Project Brief: susej - Social Commerce Marketplace

**One-line:** Instagram feed + OLX selling + Facebook communities in one
marketplace app ("susej").

**Concept pillars**
1. Product Posts - listings look like social posts (IG-style) with commerce CTAs.
2. Follow Sellers feed algo - follow sellers you trust, see their drops first.
3. Community + Commerce - FB-group style communities around categories.
4. Map + Social - seller pins / store locations on a real map.
5. Negotiate in Chat - DM threads bound to products, price haggling.
6. Seller Verification blue tick + Trust surfaces (reviews from real orders).
7. Local-first with server mirror - app works offline-first; every mutation
   mirrors to the platform DB via HTTP APIs when reachable.

**Surfaces**
- Buyer app (Expo RN): Feed/Stories/Explore/Category/Map/Community/Product/
  Cart/Checkout/Orders/Chat/Profile.
- Seller app: become-seller wizard (4 steps incl. mandatory store-location map),
  create-post wizard, seller hub/storefront/orders/promotions.
- Admin panel (Next.js): 60+ pages over shared PostgreSQL.

**Definition of "Rebuild"**: reference Figma only as idea board; build what a
real logical practical app needs (more content, scroll, states, wiring). Three-
source method: Figma skeleton + industry practice + own judgment.
