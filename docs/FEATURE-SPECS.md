# susej — Detailed Feature Specifications

> Extracted from AGENTS.md for reference. AGENTS.md contains the summary + pointers here.
> This file has: Feature Specs (1-12), Business Decisions (1-10), Design & Product Decisions (1-5).

---

## DETAILED FEATURE SPECIFICATIONS (Turn 13 — User Q&A + Agent Suggestions)

### 1. 👤 USER PROFILE VIEW — What Other Users See

When user taps ANY profile (seller or regular):
- Avatar, username, @handle, verified badge, bio
- Stats: Posts / Followers / Following
- Follow + Message buttons (Instagram style)
- Tabs: Posts / Videos / Shop (Instagram grid)
- Price overlay on EACH post image
- Video posts with Buy button
- If seller: full shop section with product grid

**YES — every post, video, reel can have a BUY/SELL tag.**

---

### 2. 🚫 BLOCK / PRIVACY

| Privacy Feature | How It Works |
|---|---|
| Block User | They can't see your profile, posts, or message you |
| Hide Profile (Private) | Only followers can see your posts — approve follow requests |
| Hide Phone/Email | Toggle visibility of personal info on profile |
| Story Privacy | Public / Followers Only / Close Friends |
| Post Visibility | Public / Followers Only / Only Me |
| Location Sharing | Show approximate location only / Hide completely |
| Read Receipts in Chat | Toggle on/off — seen status |
| Last Seen | Show / Hide / Friends Only |
| Report User/Post | Flag inappropriate content → admin review |
| Restrict (soft block) | Their comments only visible to them, messages go to message requests |

---

### 3. 🗺️ MAP VIEW — Shows BOTH sellers AND communities (toggle)

**Sellers View:** Pins = shops nearby, tap pin → See profile → Buy, filter by category
**Communities View:** Pins = active communities, tap → Join → Post/Discuss
Also show: 🟢 Online sellers nearby, 🔵 Offline / delivery only, ⭐ Top rated in area

---

### 4. 📱 APP NAVIGATION — 5 Tabs

| Tab | What's Inside |
|---|---|
| 🏠 Feed | Posts from people you follow + recommended products nearby |
| 🔍 Explore | Search, Categories, **Map**, Communities, Hashtags, Trending |
| ➕ Create | Create post (product/listing) |
| 💬 Chat | DMs, negotiations, video/voice calls, community chats |
| 👤 Profile | Your profile, listings, orders, cart, settings, followers, bookmarks |

Everything else goes inside Explore or Profile as sub-screens.

---

### 5. 💬 CHAT — Text + Voice Call + Video Call

| Feature | Details |
|---|---|
| Text Messages | Real-time with WebSocket |
| Voice Messages | Record and send audio clips |
| Voice Call | Free VOIP call between users |
| Video Call | Face-to-face — great for showing products |
| Image/Video Sharing | Send product photos in chat |
| Location Sharing | Send meetup location |
| Price Negotiation | Offer/Counter-offer system in chat |
| Deal Button | "Accept Offer" → creates order |
| Read Receipts | Seen/Sent/Delivered status |
| Typing Indicator | "John is typing..." |
| Block/Restrict | Block from profile |
| Chat Search | Search messages |

---

### 6. ✏️ EDIT PROFILE — Instagram/Facebook Style

- Change Photo / Add Video Intro (15-sec)
- Name, Username, Bio, Website
- **Business Info:** Category dropdown, Shop Name, Business Email/Phone, Address
- **Social Links:** Instagram, WhatsApp, Website
- **Privacy:** Private Account, Show Phone/Email/Location, Read Receipts, Last Seen
- **Notifications:** Push, Email, SMS toggles

---

### 7. 📦 SHOPPING — Order Tracking (Amazon-style)

Order status timeline: ✅ Order Placed → ✅ Payment Done → ✅ Seller Confirmed → 🚚 Shipped → ⏳ Out for Delivery → ⏳ Delivered
Live tracking map, ETA, courier name, tracking number
Actions: Contact Seller, Track on Map, Report Issue

---

### 8. 🍔 FOOD DELIVERY — Swiggy/Zomato Style

Food is a category within the marketplace:
- Restaurant cards: ⭐ rating, delivery time, distance, Veg/Non-Veg
- Live order tracking with rider map (Swiggy-style)
- Same delivery ecosystem for other categories
- Ratings and reviews, cuisine filter, scheduled orders

---

### 9. 📦 PARCEL/COURIER — Delivery Tracking

| Type | Tracking |
|---|---|
| Local Same-Day | Live GPS map (like Swiggy) |
| City Delivery | Milestone tracking (Amazon-style) |
| Intercity/Courier | Full courier tracking with Track ID |
| Meetup/Pickup | Location sharing + chat |
| Scheduled Delivery | Date/time picker |

---

### 10. 📍 LOCATION & FILTER BASED PRODUCTS

**Feed Algorithm:**
1. FOLLOWED sellers' products ← Always on top
2. TRENDING near you ← Location-based
3. POPULAR in your city ← City-level
4. RECOMMENDED for you ← Interest-based

**Explore Filters:** Distance radius, Category, Sort (Popular/Newest/Nearest/Cheapest), "Available for pickup today", "Verified Sellers Only", Price range, Condition (New/Used/Refurbished), Rating

---

### 11. 🎁 ADDITIONAL FEATURES (30+ items)

**HIGH priority:** Seller Verification Badge, Reviews & Ratings, Wishlist/Save, In-App Payments, Multi-photo Listings, Push Notifications, Product Condition Labels, Delivery Options Display
**MEDIUM:** Price Comparison, Negotiate Price, Bundle Deals, Seller Dashboard, Video Listings, Size/Variant Selector, Multi-language, Price Drop Alerts, Seller Response Time, Appointment Booking, QR Code for Shop, Refer & Earn, Loyalty Points, In-App Wallet, Group Chats, Broadcast Channels, Saved Searches, Seller Badges, Customer Support Chat
**LOW:** Recently Viewed, Inventory Count, Live Shopping Events, Similar/Recommended Items, Before/After Photos, AR Try-On, Disappearing Messages, Compare Products

---

### 12. 💭 WHAT MAKES THIS APP WIN

1. "Every product is a social post" — OLX is boring listings, Instagram doesn't let you buy
2. Food delivery + marketplace + social — super app
3. 17 industries — not just fashion or electronics
4. Communities + Commerce — Facebook Groups with built-in marketplace

**Risks:** Don't build everything at once. Start with Fashion + Electronics + Food + Local Services + Beauty. Use Firebase for chat, Cloudinary for storage, Google Maps, Razorpay for payments.

---

## USER CONFIRMED FEATURES (Turn 13)
- ✅ User profile shows posts, videos, products — all with BUY/SELL tags
- ✅ Block/Privacy system — full privacy controls like Instagram
- ✅ Map shows BOTH sellers AND communities (toggle)
- ✅ 5 bottom tabs: Feed, Explore, ➕ Create, Chat, Profile
- ✅ Chat supports text + voice call + video call
- ✅ Edit profile — Instagram/Facebook style with business info
- ✅ Shopping tracking — Amazon-style timeline + live map
- ✅ Food delivery — Swiggy/Zomato style with live rider tracking
- ✅ Parcel/courier — multiple delivery types tracked
- ✅ Location-based feed + filters (distance, category, price, rating)
- ✅ All 30+ additional features from agent suggestions

---

## BUSINESS DECISIONS (Turn 14)

### 1. 💰 MONETIZATION — Hybrid Model
- Transaction Fee: 3-5% per sale (paid by seller)
- Delivery Commission: 10-15% on delivery orders
- Premium Seller Plan: ₹499/month — analytics, priority listing, verification badge
- Featured Listings: ₹99 to boost listing to top for 7 days
- Free to list, free to browse. Seller pays only when they sell.

### 2. 🤝 TRUST & SAFETY
- Dispute: Buyer raises → Seller 24hrs to respond → Platform reviews if disagreed
- Refunds: Item not as described (seller pays, 3-5 days), Item not received (5-7 days)
- Moderation: AI filter → User reports → Human review. 3 strikes = suspended, 5 = permanent ban
- Banned: Weapons, drugs, counterfeit, stolen, adult content, hazardous chemicals

### 3. 📋 SELLER VERIFICATION
- Individual: Aadhaar + selfie + OTP verified
- Business: GST + business registration + PAN + bank + address proof
- Admin reviews 24-48hrs → Blue tick if approved
- Verified: unlimited listings, shipping, 7-day payment hold. Unverified: 10 listings, pickup only, 14-day hold.

### 4. 🚚 DELIVERY MODEL
- Option A: Seller Ships (Shiprocket/Delhivery integration)
- Option B: Local Delivery (like Swiggy, live GPS)
- Option C: Meetup (like OLX, share location)
- COD: Yes — essential for Indian market

### 5. 📋 LEGAL & COMPLIANCE
- GST on commission (18%), seller collects GST on sales
- Users 18+ to sell, platform is intermediary
- Data stored in India, no third-party selling, users can request deletion

### 6. 🏁 MVP SCOPE (Phase 1, 4-6 weeks)
Product Posts (IG-style), 5 Categories, Follow/Unfollow, Enhanced Chat, Seller Profiles, Map with Pins, Basic Search, Multi-photo Listings, Reviews & Ratings, Basic Order Tracking

### 7. 🎯 TARGET MARKET
India first — Tier 2 cities: Bangalore, Pune, Jaipur, Coimbatore, Kochi → expand to Chennai/Hyderabad/Ahmedabad → Delhi/Mumbai/Kolkata → All India

### 8. 📈 GROWTH STRATEGY
- Seller-first: Cold outreach to Instagram/Facebook sellers, local market visits, referral program, zero commission first 3 months
- Buyer-first: Instagram/TikTok marketing, referral (₹100 credit each), SEO/ASO, community seeding, local influencer partnerships

### 9. 🛠️ TECH DECISIONS
- Chat: Firebase (Phase 1, free tier). Storage: Cloudinary (free 25GB). Maps: Google Maps. Payments: Razorpay (UPI + COD)

### 10. 🏆 COMPETITION
- OLX (boring listings), Meesho (no local/social), Facebook Marketplace (scam-filled), Instagram Shopping (no local/negotiation), WhatsApp Business (no discovery)
- Our edge: Social posts + Follow sellers + Communities + Map + Negotiate in chat

---

## DESIGN & PRODUCT DECISIONS (Turn 15)

### 1. 🎨 DESIGN SYSTEM

**Colors:**
- Primary Brand: #FF6B35 (Orange)
- Secondary: #1A1A2E (Dark Navy)
- Accent: #FF2D55 (Pink-Red for CTAs/likes)
- Light: White bg, #F5F5F5 surface, #1A1A2E text, #666666 secondary, #E5E5E5 border
- Dark: #121212 bg, #1E1E1E surface, #FFFFFF text, #A0A0A0 secondary, #2A2A2A border
- Status: Green=#00C853, Amber=#FFB300, Red=#FF1744, Blue=#2196F3

**17 Category Colors:** Fashion=#FF6B9D, Electronics=#4A90D9, Real Estate=#7B68EE, Automobiles=#FF6B35, Food=#00C853, Beauty=#FF69B4, Fitness=#FF4500, Education=#1E90FF, Home Services=#8B4513, Art=#9B59B6, Pets=#F4A460, Agriculture=#228B22, Kids=#FFD700, Services=#20B2AA, B2B=#708090, Jobs=#5080C0, Medical=#40C0A0

**Typography:** Inter Bold (headings), Inter Regular (body), Inter Bold+Large (prices), Inter Medium (captions)
**Sizes:** H1=28px, H2=22px, H3=18px, Body=16px, Caption=14px, Small=12px

**Spacing (4px base):** xs=4, sm=8, md=12, lg=16, xl=24, xxl=32
**Radius:** Small=8 (buttons/inputs), Medium=12 (cards), Large=16 (modals), Full=9999 (avatars)
**Shadows:** Small=0 1px 3px rgba(0,0,0,0.12), Medium=0 4px 12px rgba(0,0,0,0.15), Large=0 8px 24px rgba(0,0,0,0.2)

**Components:** Primary button=#FF6B35 bg, white text, 12px radius. Cards=white bg, 12px radius, shadow. Inputs=48px height, 1px border, 8px radius.

### 2. 👋 ONBOARDING FLOW (8 steps)
1. Splash: susej brand + "Buy. Sell. Connect."
2. Welcome carousel (3 screens): Post Products / Buy & Sell / Join Communities
3. Signup: Phone OTP (primary) + Google/Apple (optional)
4. Phone + OTP: +91 number input
5. Profile Setup: Photo, Name, Username, Buyer/Seller/Both
6. Location: Auto-detect or manual city select
7. Interests (optional): Pick 3+ from 17 categories
8. Home Feed first-time: "Follow some sellers" prompt

Decisions: Phone OTP (India standard), skip everywhere optional, location auto-detect with override, interests optional, no tutorial, subtle tooltips.

### 3. 🗄️ BACKEND STRUCTURE

**Database (PostgreSQL) — 19 tables:**
users, seller_profiles, products, product_images, product_variants, follows, likes, saves, comments, communities, community_members, community_posts, conversations, conversation_participants, messages, orders, reviews, notifications, verification_requests

**API Endpoints (FastAPI):**
- Auth: send-otp, verify-otp, signup-google, me
- Users: get, update, posts, followers, following
- Follows: follow/unfollow
- Products: CRUD, feed, explore, like, save, comments
- Search: products, sellers, communities, hashtags
- Map: sellers by location, communities by location
- Communities: CRUD, join, leave, posts
- Chat: conversations, messages, read receipts
- Orders: create, list, status update, disputes
- Sellers: verify, dashboard
- Notifications: list, read, settings
- Upload: image, video

### 4. 📸 CREATE POST FLOW (6 steps)
1. Choose Media: Camera / Gallery / Video (up to 10 images)
2. Edit Images: Filters (Original/Warm/Cool/B&W/Vivid), Crop (Free/1:1/4:5)
3. Product Details: Title, Price (mandatory), Category, Subcategory, Condition (New/Like New/Used/Refurbished), Description, Hashtags
4. Delivery Options: Pickup, Shipping (with fee), Local Delivery
5. Location: Current or select on map
6. Preview & Post: Final check, post to Feed or Community

Decisions: 10 max images, 60s max video, hashtags auto-suggest, price mandatory, category mandatory, condition required, draft auto-save.

### 5. 🛡️ MODERATION

**3 Layers:**
1. AI Filter: Auto-flag nudity/violence/spam/duplicates/suspicious pricing
2. User Reports: Report button → queue for review, multiple reports = faster
3. Human Review: Admin dashboard → Keep/Remove/Ban, appeals process

**Team:** MVP = you + 1-2 friends (free) → Growth: 1-2 part-time (₹15-20K/mo) → Scale: 3-5 full-time + AI (₹50K-1L/mo)

**Rules:** Spam=warning→7d ban→perm. Scam=30d ban→perm. Inappropriate=warning→7d→perm. Fake listing=warning→30d→perm. Harassment=7d→30d→perm.
