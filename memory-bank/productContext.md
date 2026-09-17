# Product Context

## Why it exists
Emerging-market mobile sellers live on Instagram/OLX/Facebook simultaneously.
susej collapses them into one marketplace where selling is as social as posting,
and buying starts from your feed rather than empty search boxes.

## UX goals
- Dead-simple flows: splash -> phone OTP -> interests -> feed in < 2 minutes.
- Honest states everywhere: truthful loading, empty, error; no fake numbers,
  fake badges, or phantom discounts (user has run deep audits proving this).
- INR currency, Indian addresses/cities defaults, rupee-mangled font awareness
  when reading device dumps.
- Buyers and sellers are separate journeys; UI is role-aware (role-based bottom
  nav, seller-only creation tiles).

## Anti-goals (permanent)
- No subscription paywalls for core features; monetization = commissions +
  paid VISIBILITY/trust SKUs (spotlight pin, pinned chat, verified tag path).
- No fabricated demo data in runtime paths.
- No pixel-cloning of real apps (IG screenshots etc.) - original practical design.

## Current experience snapshot (stable truths)
Feed = stories rail + shop-by-category + For You & All rails + posts grid w/
Sponsored spotlight support. Product pages carry delivery card, comments sheet,
chat handoff. Storefronts show banner/theme/identity card/reviews tab sourced
from REAL delivered-order reviews incl anonymous ones. Admin manages KYC queue,
orders lifecycle, promo pricing (live-consumed by app via /api/v1/config),
content moderation mirrors both directions.
