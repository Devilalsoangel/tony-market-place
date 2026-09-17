# Decisions Log (do NOT re-litigate settled rows)

| Decision | Chosen | Reason | Revisit if |
|---|---|---|---|
| Monetization model | Promotions & Ads + commission (IG boost / OLX featured pattern), NO subscriptions | User rejected paywalls-as-products; real marketplaces sell VISIBILITY/TRUST/LEADS | User reopens monetization |
| Seller Pro extras | Free analytics + themes; paid SKUs = Feed Spotlight Rs49, Pinned Chat Rs79 | Theme/analytics judged worthless to buy alone; visibility sells | - |
| Data seeding | REAL app-flow creation ONLY (OTP signup -> profile -> seller wizard -> admin approve -> create posts); seed.ts CONFIG-ONLY | Data integrity audits proved mock crowds poison every surface | Never |
| Cross-account safety | ALL persisted identity keys username-scoped; purge lists on logout/login/serverLogin | Draft/wallet leak family found in tester walk | - |
| Navigation | Bottom-tab only; hamburger purge done; hidden tab bar inside chat threads/community (immersive) | User mandate Aug 25/26 | - |
| Maps | WebView Leaflet inline bundle (react-native-maps DEAD in Expo Go); draggable picker in wizard | Blank-tile failures + Expo Go limitation | Standalone builds |
| Money math | Server-authoritative totals/commission/refunds; deliveryFee validated set {0,12,30} | Client multiplication caused dupe/money bugs R-series | - |
| Verification culture | Evidence gates mandatory (tsc/API-JSON/DB rows/pixel scans); UNVERIFIED must be said out loud | User standing order | - |
| Device driving | Real taps/gestures only; deep links forbidden for navigation (plain am start OK); GPT vision judges screens | User corrections Aug 24-26 | - |
| Model behavior | Turn-director resume-first: new messages AMEND standing plans; deep-memory harvest before direction | User correction Aug 27 | - |
| Zen failover proxy (Sep 2026) | Local proxy at 127.0.0.1:8096 owns opencode provider baseURL; on 429/5xx rotates free-model chain (muse 1.2/1.3 -> mimo-v2.5 -> nemotron-3.5-lightning -> nemotron-ultra -> deepseek-flash) with persisted cooldowns | User is anonymous to Zen (no API key) => limits are per-IP per-model; probe proved per-model buckets (muse 500 while mimo/nemotron 200). No VPN CLI on PC so IP rotation not automatable | If Zen changes model IDs or gates all free models behind keys, update CHAIN in failover-proxy.mjs |
