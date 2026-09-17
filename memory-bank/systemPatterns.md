# System Patterns

## Architecture shape
App (offline-first Context layer) --HTTP--> admin Next.js server --> PostgreSQL.
ONE Postgres instance; two access planes:
- App plane `/api/app/*` Bearer `susej_` token (minted at /api/app/auth/verify).
- Admin plane cookie `susej_session` via /api/login + /api/login/verify-2fa.
Writes limited by x-app-key allowlist resources.

## Established patterns (follow, don't invent)
1. **Context per domain** (Auth/Post/Cart/Order/Follow/Notification/Community/
   Bookmark/RecentlyViewed/Promotion...): load-merge-persist AsyncStorage,
   guard re-entry with loaded refs; identity-scoped keys purge on logout/switch
   via clearMoneyCache-style multiRemove lists.
2. **tokenSeq/sessionSeq counters** bump AFTER real token save; downstream
   contexts refetch keyed by username:tokenSeq - fixes re-switch staleness.
3. **Server mirror rows**: Post<->Product (lst_<id>), Seller<->User propagation
   by phone digits, moderation reverse-sync both directions.
4. **Server-authoritative money**: totals/commission computed server-side;
   wallet tx only in WalletTransaction ledger rows; refunds exactly-once;
   COD vs debit handled distinctly. Client NEVER multiplies fees itself.
5. **Prisma 7 nested relations**: bare arrays CRASH - normalizeRelationArrays
   converts documents:[...] -> {create:[...]}; drop empties.
6. **Honesty components**: empty-state text states what's missing and why.
7. **Admin pages**: initialize state from hook data (`useState(rows)` NOT null)
   else SSR shows empty tables; useDbResource refetches on window focus.
8. **Promo pricing live path**: admin edits promoPrices AppSetting -> /api/v1/config
   merged catalog -> app loadsMarketplaceConfig fresh EVERY mount.
9. **Role gates in UI**: role-based tab bar; creation screens guard
   `if (!user.isSeller)` honest gate with Become-a-Seller CTA.

## Component relationships worth knowing
ProductCard is the universal listing renderer (image chain via
resolveListingImage/resolveAvatar; source ordering real URI -> registry ->
deterministic placeholder; NEVER cycling by index).
Comments unified through PostEngagementSheets (single sheet impl).
Map = react-native-webview Leaflet inline bundle (react-native-maps DEAD in
Expo Go); draggable marker variant flag used by location pickers.

## Critical implementation paths
Auth verify: api/app/auth VERIFY route re-reads user post-session-create then
client reconcileIdentity() GET /users/me guards expectedToken race.
Order lifecycle: placed->confirmed->preparing->out_for_delivery->delivered|
cancelled; single writer = orders POST + PATCH [id]; admins read same rows.
