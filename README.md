# susej — Tony Market Place

Social Commerce Marketplace — Instagram-style feed + OLX-style selling + Facebook-style communities, all in one app.

## Repo structure

| Folder | Stack | Purpose |
|---|---|---|
| `Frontend/` | React Native / Expo SDK 57 / TypeScript | Mobile app (buyer + seller flows, map, communities, promotions) |
| `susej-admin-panel/` | Next.js 16 / TypeScript / Prisma / SQLite | Super-admin command center (orders, refunds, promotions, commission, moderation) |

## Concept

- **Buyers** browse product posts in an Instagram-style feed, chat to negotiate, track orders, join communities, explore sellers on a map.
- **Sellers** get verified (blue tick), create product posts, run promotions (boost posts / hot deals / top seller), manage orders and payouts.
- **Admins** run the whole marketplace: order lifecycle (placed → confirmed → preparing → out for delivery → delivered → cancelled), refunds, withdrawals, disputes, auctions, promotions catalog and commission settings.

## Getting started

### Mobile app

```bash
cd Frontend
npm install
npx expo start
# scan the QR with Expo Go (SDK 57)
```

### Admin panel

```bash
cd susej-admin-panel
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev   # http://localhost:3000
```

Demo admin login: `alexrivera` / `Admin@123`

## Key features

- 66+ screens, 5-tab architecture (Feed / Explore / Create / Chat / Profile)
- 17 industries, follow-seller feed algorithm, product-post format
- Map with seller pins (Leaflet + Carto tiles in Expo Go)
- Communities + hashtags + saved collections + reels/stories
- Negotiation in chat, price-drop alerts
- Order lifecycle + live tracking + rate & review
- Wallet with seller earnings, 8% commission, payout requests (Rs 20 fee)
- Promotions & ads engine: Top Seller, Hot Deal, Boost Post (IG/OLX/FB pattern)
- App → admin live sync bridge (orders, tickets, withdrawals, promotions, refunds)
- Seller verification queue, disputes, moderation, reported content

## Design system

Stitch "Modern Violet" — seed `#5d5fef`, roundness 8/24/16, Inter font, Material tokens (surfaceContainerLow `#f5f2ff`, outlineVariant `#c7c4d7`, ...) via `Frontend/utils/theme.ts`.

---

Licensed by **tonystacks**.
