# susej — UI Pixel-Perfect Reference

> **Source:** Figma file `ZaRKwIZFnGxM4kVAZgOWwd` (32 screens)
> **Rule:** Reproduce Figma 1:1. No approximations. No design decisions.

---

## DESIGN SYSTEM (from Figma)

### Brand
- Seed color: `#5d5fef`
- Primary: `#4343d5`
- PrimaryContainer: `#5d5fef`
- Style: Modern Minimalism, Soft Tactility

### Typography
| Usage | Font | Size | Weight | LetterSpacing |
|-------|------|------|--------|---------------|
| Headings | Inter | 20-32px | 700 (Bold) | -0.02em |
| Body | Inter | 14-16px | 400 (Regular) | 0 |
| Labels | Inter | 12-14px | 500-600 (Medium/SemiBold) | 0.01-0.02em |
| Small/Badges | Inter | 10px | 500 | — |

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| figma-4 | 4px | Checkboxes, small elements |
| figma-8 | 8px | Chips, small cards, New button |
| figma-12 | 12px | Buttons, segmented tabs, nav items |
| figma-16 | 16px | Inputs, search bars, cards, containers |
| figma-20 | 20px | Bottom sheets, large containers |
| figma-24 | 24px | Feed cards, major containers, stats row |
| figma-full | 9999px | Avatars, badges, tags, pills |

### Colors (Exact Figma)
| Token | Hex | Usage |
|-------|-----|-------|
| primary | `#4343d5` | Brand, active tabs, links |
| primaryContainer | `#5d5fef` | Buttons, active states, badges |
| surface | `#fcf8ff` | Screen backgrounds |
| surfaceContainerLow | `#f5f2ff` | Input bg, chip bg, stats row bg |
| surfaceContainer | `#efecff` | Image placeholders, dividers |
| surfaceContainerLowest | `#ffffff` | Card backgrounds |
| textPrimary | `#1a1a2e` | Main text, headings |
| textSecondary | `#464555` | Secondary text, subtitles |
| secondary | `#5c5e63` | Inactive tabs, muted text |
| outlineVariant | `#c7c4d7` | Borders, dividers |
| tertiary | `#50519b` | Tags, badges |
| error | `#ba1a1a` | Errors, danger actions |
| errorContainer | `#ffdad6` | Error bg, danger button border |

---

## SCREEN SPECS (Pixel-Perfect)

### Tab Screens

#### 1. FeedScreen (`(tabs)/feed.tsx`) — Figma 1:3640 (526×2116)
| Element | Specs |
|---------|-------|
| Header | ☰ susej ♡ 🛍 — 56px |
| Stories section | 128px total, 74×74 avatar ring (3px padding → 68×68), 8px gap to label, 16px gap between stories, 17px top padding |
| Post card | 486×726, borderRadius 24, white bg, shadow offsetY 4 radius 20 opacity 0.06 |
| Product image | Full width, with price badge (#5d5fef, top-right) |
| Interaction bar | Heart+count, Comment+count, Share, Bookmark |
| CTA | "Buy Now" + "Message" buttons, 12px rounded |
| Separator | 24px between posts, no filter chips |

#### 2. ExploreScreen (`(tabs)/explore.tsx`) — Figma 1:3512 (527×1132)
| Element | Specs |
|---------|-------|
| Header | ☰ susej ♡ 🛍 |
| Search section | 16px gap |
| Map pill | 12px gap, shadow |
| Category chips | Pill shape, #f5f2ff bg, #5c5e63 inactive text, active=#5d5fef+white |
| Trending section | 16px margin |
| Masonry grid | 16px gap, card shadow opacity 0.04 |

#### 3. CreateScreen (`(tabs)/create.tsx`) — Figma 1:3346 (527×1034)
| Element | Specs |
|---------|-------|
| Header | ✕ New Post → Next |
| Image grid | 3 columns, 4px gap |
| Tab bar | Photo/Video, 600 weight active, secondary color inactive |
| Grid picker | No vertical padding (0) |

#### 4. MessagesScreen (`(tabs)/chat.tsx`) — Figma 1:3387 (525×1155)
| Element | Specs |
|---------|-------|
| Header | ☰ susej ♡ 🛍 |
| Search bar | bg surfaceContainerLow, 47px height, 12px radius |
| Tab border | surfaceContainerLow color |
| Inactive tab | secondary color |
| Online indicator | 9999px (pill) radius |
| Bottom nav | paddingHorizontal 12, gap 7 |

#### 5. ProfileScreen (`(tabs)/profile.tsx`) — Figma 1:1752 (390×1023)
| Element | Specs |
|---------|-------|
| Header | ☰ susej ♡ 🛍 |
| Avatar | 104×104 ring |
| Stats row | 24px gap between items, paddingRight 4 |
| Profile name | marginTop 16 |
| Username/bio | marginTop 0 |
| Highlights row | paddingBottom 24 |
| Tab bar | paddingVertical 16 |

---

### Commerce Screens

#### 6. ProductDetailsScreen (`product/[id].tsx`) — Figma 1:3211 (526×2011)
| Element | Specs |
|---------|-------|
| Header | ← susej 🛍 |
| Product image | height ratio 0.93 of width |
| Price | 16px, regular weight |
| Action buttons | Column, 56px height |
| Make Offer | solid tertiary bg |
| Description | 11px regular |
| Seller avatar | 48px |
| Follow button | outlineVariant border |
| Similar items | 2-column grid, 0 gap, marginTop sm(8) |
| Offer button text | color #ffffff |

#### 7. SellerProfileScreen (`seller/[username].tsx`) — Figma 1:2765 (526×1666)
| Element | Specs |
|---------|-------|
| Header | 52px, back (18×18) + "Seller" title (center, 20px #4343d5) + More btn (16×26) |
| Avatar | 96×96 pill |
| Name row | Horizontal, 24px gap, verified badge |
| Stats row | 486×74, bg #f5f2ff, borderRadius 24, pad 24/24/16/16, 4 stats (Posts/Followers/Following/Rating) |
| Buttons | Follow + Message, 48px h, 12px radius |
| Tab bar | 3 tabs (Products/Reviews/About), 16px, active=primaryContainer color + 2px underline |
| Product grid | 2 cols, 237×241 cards, 24px radius, 20px horizontal padding |

#### 8. CartScreen (`cart.tsx`) — Figma 1:2 (390×882)
| Element | Specs |
|---------|-------|
| Header | ← Cart 🛍 |
| Item cards | Horizontal layout, 24px radius |
| Quantity selector | Plus/minus buttons |
| Total section | Fixed bottom, checkout button |
| Bottom nav | 55px |

#### 9. OrdersScreen (`orders.tsx`) — Figma 1:1204 (390×1497)
| Element | Specs |
|---------|-------|
| Header | ← Orders |
| Order cards | Status badge, product image, price, date |
| Tabs (if any) | Active/inactive styling |
| Bottom nav | 55px |

#### 10. SavedCollectionsScreen (`saved.tsx`) — Figma 1:1102 (390×1044)
| Element | Specs |
|---------|-------|
| Header | Back + "susej" (20px #4343d5) + New button (16px white on primary bg, 8px radius) |
| Title | "Saved Items" — 32px #1a1a2e, Bold |
| Subtitle | "Organize your inspirations and\nwishlist" — 16px #464555 |
| Segmented tabs | Collections (badge "4") / All Items (badge "128") — 12px radius container |
| Active tab | White bg pill, 8px radius |
| Collection cards | 2 cols, 16px radius, white bg, shadow, 112px image placeholder, 14px name |
| Items grid | 3 cols, 4px gap |

---

### Social & Info Screens

#### 11. SettingsScreen (`settings.tsx`) — Figma 1:271 (390×1234)
| Element | Specs |
|---------|-------|
| Header | ← Settings (20px #4343d5, Bold) |
| Section titles | 700 weight |
| Menu items | 500 weight labels |
| Search bar | 12px radius, 47px h, paddingLeft 32 |
| Logout | solid #FFDAD6 bg, 500 weight text |
| Bottom nav | solid bg |

#### 12. NotificationsScreen (`notifications.tsx`) — Figma 1:993 (390×931)
| Element | Specs |
|---------|-------|
| Header | ← susej |
| Notification cards | Underline separator, image thumbnail, action buttons, dot indicator |
| Bottom nav | 55px |

#### 13. EditProfileScreen (`edit-profile.tsx`) — Figma 1:622 (390×1662)
| Element | Specs |
|---------|-------|
| Header | 52px: Back + "Edit Profile" (20px #4343d5) + "Save" (14px #4343d5) |
| Avatar | 96×96 pill, "Change profile photo" (16px #4343d5, SemiBold) |
| Fields | Label (16px #5c5e63, Medium), Input (16px Inter Regular, #f5f2ff bg, 16px radius, 56px h) |
| Business Info | Category, Shop Name, Business Email, Business Phone, Address — 32px top padding |
| Category picker | Chip grid, pill shape, active=#5d5fef+white, inactive=#efecff |
| Privacy section | 5 toggles, 32px top padding, 12px vertical padding per row, border bottom #efecff |
| Danger | "Deactivate Shop Account" — #ba1a1a, 56px h, 16px radius, #ffdad6 border |

---

### Onboarding Screens (8 screens)

#### 14. SplashScreen — Figma 1:1862 (390×1061)
- Geist 40px/700 logo "susej"
- Inter 16px/400 subtitle
- 350×56 signup buttons

#### 15. WelcomeCarousel — Figma 1:1935 (390×884)
- Carousel with 3 slides
- Dot indicators
- "Get Started" CTA button

#### 16. AuthenticationScreen — Figma 1:1894 (390×1140)
- 500×500 purple circle at 10% opacity
- Bento grid layout
- Google / Phone / Login buttons

#### 17. OnboardingOTP — Figma 1:1547 (390×884)
- SMS icon
- Phone → OTP flow
- 6 input boxes
- "AES-256" security footer

#### 18. OnboardingLocation — Figma 1:1591 (390×1103)
- Map + gradient overlay
- "Allow Location Access" button
- City cards
- Progress dots

#### 19. OnboardingProfileSetup — Figma 1:1680 (390×906)
- 128×128 avatar + camera+plus overlay
- Full Name / Username inputs
- 3-segment role picker (Buyer / Seller / Both)

#### 20. OnboardingInterests — Figma 1:1334 (390×1020)
- 2×4 grid (169×160 chips per cell)
- Step counter (e.g., "2/3")
- Disabled → active Continue button

#### 21. OnboardingFirstFeed — Figma 1:1432 (390×1295)
- Full Header + Nav + BG
- Welcome Hero (#5d5fef)
- Suggested sellers horizontal scroll
- Empty feed state
- Bottom nav

---

### Remaining Screens (Quick Reference)

| Screen | Figma Node | Size | Key Elements |
|--------|-----------|------|-------------|
| Community Chat | 1:122 | 390×1826 | Chat bubbles, message input, community info |
| Communities Hub | 1:2589 | 526×1847 | Community cards, search, categories |
| Category Discovery | 1:2198 | 527×1473 | Industry grid, search, icons |
| Food Hub | 1:421 | 390×1850 | Search, Hero, Featured Banner, Bento grid |
| Seller Dashboard | 1:763 | 390×992 | Stats, earnings chart, product management |
| Rate & Review | 1:905 | 390×910 | Product, stars, photo upload, review, toggle |
| Book a Service | 1:2368 | 525×1577 | Provider hero, highlights, booking, pricing, reviews |
| Become a Seller | 1:2514 | 527×1038 | Multi-step form, success modal |
| Track Order | 1:2919 | 525×1472 | Timeline, map, order summary |
| #Vintage Results | 1:2026 | 526×1318 | Hashtag header, post grid |
| Nearby Sellers | 1:3058 | 526×1038 | Map, seller cards |
| Map | — | — | Map screen with seller pins |

---

## COMPONENT SPECS

### UI Primitives

**Button**
- 350×56 (full width) or flexible
- 12px or 16px radius
- Primary: #5d5fef bg, white text, 14px/600
- Outline: 1px border outlineVariant, textPrimary text

**Input**
- 48-56px height
- 16px radius
- #f5f2ff bg
- No visible border
- Focus: #5d5fef accent

**Chip (Pill)**
- 100px pill radius
- #f5f2ff bg (inactive)
- Active: #5d5fef bg + white text
- 12-14px text, Medium

**Avatar**
- Default 40×40
- Story ring: 74×74 (3px padding → 68×68)
- Profile: 96×96 or 104×104
- Pill radius (9999px)

**PriceTag**
- #5d5fef bg
- White text
- Small, compact
- Top-right positioned on images

### Cards

**ProductPostCard (Feed)**
- 486×726 total
- 24px border radius
- White bg with shadow
- 40px seller avatar + name/location row
- Product image with price badge overlay
- Interaction bar (heart, comment, share, bookmark)
- "View all X comments" link
- Buy Now + Message CTA buttons

**ProductGridCard (Explore/Grid)**
- 237×241 (or square)
- 24px radius
- White bg
- Product image + title + price

**CollectionCard (Saved)**
- 2-column grid
- 16px radius
- White bg + shadow
- 112px image placeholder
- Name (14px, SemiBold) + count (12px, Regular)

---

## VERIFICATION CHECKLIST

Before considering a screen done:
- [ ] Frame dimensions match Figma
- [ ] Every Figma text node present with exact content
- [ ] Typography matches (font, size, weight, letterSpacing, lineHeight)
- [ ] Colors match Figma hex (use `colors.*` tokens, no hardcoded)
- [ ] Border radii match Figma
- [ ] Shadows match Figma
- [ ] SVG icons from Figma exports (no MaterialCommunityIcons)
- [ ] Images from Figma PNGs (no picsum/randomuser)
- [ ] Padding/spacing/gap matches Figma auto-layout
- [ ] Navigation works (back button, links)
- [ ] npx tsc --noEmit passes (0 code errors)

---

*Last updated: 2026-07-26*
