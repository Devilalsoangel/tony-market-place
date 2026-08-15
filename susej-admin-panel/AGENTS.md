# SUSEJ Admin Panel — Admin Panel for Social Commerce Marketplace

## Project Overview
Enterprise-level Admin Dashboard for SUSEJ, a social commerce marketplace. Desktop-only (1024px+).

## Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4 (CSS-based config)
- **UI Components**: Custom shadcn-style primitives (Radix UI)
- **Icons**: lucide-react
- **State (Client)**: Zustand (store/)
- **State (Server)**: @tanstack/react-query
- **Forms**: react-hook-form + zod
- **Tables**: @tanstack/react-table
- **Charts**: recharts
- **Animations**: framer-motion
- **Theme**: next-themes (dark/light)

## Architecture
- `src/app/` — App Router pages (`auth/` route group, `dashboard/` real segment)
- `src/components/` — React components (ui/, layout/, shared/, forms/, charts/, data-table/)
- `src/hooks/` — Custom React hooks
- `src/lib/` — Utility functions, constants, API client
- `src/services/` — API service functions
- `src/store/` — Zustand stores
- `src/types/` — TypeScript type definitions
- `src/layouts/` — Auth + Dashboard layout wrappers

## Coding Standards
- Server components by default, client components only when needed
- TypeScript strict mode — no `any`
- Tailwind CSS v4 for styling (@theme in CSS, no tailwind.config.ts)
- Zod schemas for all form validation
- Desktop-first: <1024px shows locked screen
- Dark mode supported via next-themes + CSS dark variant

## Theme
- Primary: #6C3BFF (Deep Violet)
- Sidebar: #151A2D
- Background: #F8F9FC
- Cards: #FFFFFF
- Borders: #E8EAF2
- Text: #111827 / #6B7280
- Font: Inter (weights 400, 500, 600, 700)

## Notable Packages
- @radix-ui/* — accessible UI primitives
- @tanstack/react-table — data tables with sorting/pagination
- @tanstack/react-query — server state management
- framer-motion — animations
- recharts — charts
- zustand — client state
- next-themes — dark/light mode
- sonner — toast notifications
- class-variance-authority + clsx + tailwind-merge — className utilities

---

## Build Progress

### ✅ Phase 0 — Project Scaffolding (Complete)
- [x] Next.js 16 project created with TypeScript + Tailwind
- [x] All dependencies installed (Radix UI, TanStack, Zustand, Framer, Recharts, etc.)
- [x] Folder structure created (auth + dashboard routes, components, hooks, lib, store, types, services, layouts)
- [x] Tailwind theme configured (Deep Violet #6C3BFF, Inter font, custom radius)
- [x] tsconfig paths configured (@/* -> ./src/*)

### ✅ Phase 1 — Core Infrastructure (Complete)
- [x] Theme provider (next-themes dark/light toggle)
- [x] Desktop guard (<1024px lock screen with illustration + return button)
- [x] Auth layout (centered card for login)
- [x] Dashboard layout (sidebar + navbar + content + footer)
- [x] Sidebar component (collapsible, 17 nav items with Lucide icons, active state)
- [x] Top navbar (search bar, theme toggle, notifications bell, avatar dropdown)
- [x] App providers (React Query + Theme provider)
- [x] API client (Axios with JWT interceptor + 401 handling)
- [x] Auth store + Sidebar store (Zustand with persist)
- [x] Login form (email/password with loading state)
- [x] useMediaQuery hook

### ✅ Phase 2 — Shared UI Component Library (Complete)
- [x] Button (CVA variants: primary, secondary, ghost, danger, outline + sizes)
- [x] Badge (default, success, warning, danger, info, primary)
- [x] Card + CardHeader + CardTitle + CardDescription + CardContent
- [x] Input (with icon support)
- [x] Select (native with custom styling)
- [x] Avatar (with initials fallback)
- [x] Skeleton (loading placeholder)
- [x] Separator, Label
- [x] Dialog (modal with overlay, escape close)
- [x] DropdownMenu (with DropdownMenuItem)
- [x] Tabs (underline style)
- [x] Switch (toggle)
- [x] Tooltip (hover reveal)
- [x] Popover (click toggle)
- [x] Accordion (single open)
- [x] Progress (variants: default, success, warning, danger)
- [x] Breadcrumb (with Home icon + ChevronRight)
- [x] ScrollArea
- [x] **Shared:** KPICard, EmptyState, ErrorState, LoadingState, ConfirmDialog, SearchInput, StatusBadge

### ✅ Phase 3 — Data Table Infrastructure (Complete)
- [x] Generic typed DataTable with TanStack Table
- [x] Sorting (column header click with asc/desc icons)
- [x] Pagination (page controls)
- [x] Filtering (global search)
- [x] Loading state (skeleton rows)
- [x] Empty state
- [x] Export CSV button
- [x] Toolbar slot for custom actions

### ✅ Phase 5 — Dashboard Home (Complete)
- [x] 12 KPI cards (Total Users, New Users Today, Online Users, Verified Sellers, etc.)
- [x] Revenue chart (Line chart)
- [x] User & Seller Growth chart (Area chart)
- [x] Top Categories chart (Bar chart)
- [x] Latest Orders table
- [x] Latest Users table
- [x] Latest Sellers table
- [x] Recent Activity feed
- [x] Mock data service for all entities

### ✅ Phase 6 — User Management (Complete)
- [x] Users data table (avatar, name, email, role, status, joined date)
- [x] Searchable, sortable, paginated

### ✅ Phase 7 — Seller Verification (Complete)
- [x] Sellers data table (business, KYC, GST, score, products count)
- [x] KPI cards for seller stats
- [x] Progress bar for seller score

### ✅ Phase 8 — Product Moderation (Complete)
- [x] Products data table (title, category, price, status, reports, date)
- [x] Searchable

### ✅ Phase 9 — Categories (Complete)
- [x] All 15 marketplace categories listed
- [x] Enable/Disable toggle per category
- [x] Reorder handle (UI)
- [x] Add Category button

### ✅ Phase 10 — Community Management (Complete)
- [x] Communities data table (name, members, posts, type, status, reports)

### ✅ Phase 11 — Order Management (Complete)
- [x] Orders data table (ID, buyer, seller, amount, items, status, date)
- [x] Full order lifecycle statuses

### ✅ Phase 12 — Reviews (Complete)
- [x] Reviews data table (product, reviewer, rating, status, seller/buyer ratings)

### ✅ Phase 13 — Payments (Complete)
- [x] Payments overview page (KPI cards: revenue, commission, pending payouts, withdrawn)
- [x] Payment summary breakdown

### ✅ Phase 14 — Reports (Complete)
- [x] Reported users page with moderation actions (Warn, Suspend, Ban)

### ✅ Phase 15 — Messages Moderation (Complete)
- [x] Reported chats list (user, reason, message count, severity)
- [x] Mute/Block actions per chat

### ✅ Phase 16 — Notifications (Complete)
- [x] Push notification form (title, message, target audience)
- [x] Announcement banner form
- [x] Recent notifications list

### ✅ Phase 17 — Analytics (Complete)
- [x] Revenue chart
- [x] Growth chart
- [x] Daily Active Users chart
- [x] Top Categories chart
- [x] Top Searches chart
- [x] Conversion Rate chart

### ✅ Phase 18 — Support Center (Complete)
- [x] Support tickets data table (ID, user, subject, priority, status, assignee)

### ✅ Phase 19 — Admin Roles & RBAC (Complete)
- [x] Role cards (Super Admin, Admin, Moderator, Support, Finance, Analytics)
- [x] Permission lists per role
- [x] User count per role

### ✅ Phase 20 — Audit Logs (Complete)
- [x] Audit logs data table (admin, action, entity, details, IP, timestamp)
- [x] Action type badges with color coding

### ✅ Phase 21 — Settings (Complete)
- [x] Tab-based settings (General, Marketplace, Payments, Security, Email, Feature Flags)
- [x] Form controls for each section
- [x] Save Changes buttons

### ✅ Phase 22 — Global Search / Command Palette (Complete)
- [x] Cmd+K / Ctrl+K keyboard shortcut
- [x] Search overlay with all dashboard pages
- [x] Keyboard navigation (arrows, enter, escape)
- [x] Filtered search by label and keywords
- [x] Click-on-search-bar opens palette
- [x] Integrated into dashboard layout

### ✅ Batch A — Missing UI Components (Complete)
- [x] Drawer — slide-in panel from right (escape to close)
- [x] Checkbox — custom styled with check icon
- [x] RadioGroup — custom styled radio buttons
- [x] Toast — Sonner Toaster integrated in root layout
- [x] DatePicker — native date input with calendar icon
- [x] BulkActionsBar — floating bottom bar with action buttons

### ✅ Batch B — Data Table Enhancements (Complete)
- [x] Column visibility toggle — dropdown to show/hide columns
- [x] Row selection — checkbox column + selected count + bulk actions bar
- [x] CSV export handler — exportToCSV utility + button wired up
- [x] Export Excel — exportToExcel utility (tab-separated .xls)

### ✅ Batch C — Auth pages (Complete)
- [x] `/login/2fa` — TOTP 6-digit input with auto-focus
- [x] `/forgot-password` — email reset form with success state
- [x] `middleware.ts` — route protection, public routes whitelist

### ✅ Batch D — Detail pages (Complete)
- [x] `/users/[id]` — profile with 8 tabs (Info, Listings, Orders, Messages, Communities, Reports, Login History, Devices) + Edit/Suspend/Ban/Delete/Verify/Reset Password actions
- [x] `/sellers/[id]` — KYC docs, verification timeline, seller score, approve/reject actions
- [x] `/sellers/pending` — pending verification queue with approve/reject
- [x] `/products/[id]` — image gallery, AI detection (spam/duplicate/copyright scores), approve/feature/pin/hide/delete actions
- [x] `/products/pending` — pending approval queue with approve/reject
- [x] `/communities/[id]` — 7 tabs (Members, Posts, Comments, Reported, Pinned, Rules, Banned) + member management
- [x] `/orders/[id]` — order timeline (8 lifecycles), status transition actions, order details summary

### ✅ Batch E — Payment sub-pages (Complete)
- [x] `/payments/transactions` — transactions table with gateway/type/status filters
- [x] `/payments/withdrawals` — withdrawal requests with approve/reject actions
- [x] `/payments/refunds` — refund requests with approve/deny actions
- [x] `/payments/gateway-logs` — gateway response logs (response code, latency)
- [x] `/payments/settlements` — settlement history (gross/commission/net)

### ✅ Batch F — Reports sub-pages (Complete)
- [x] `/reports/products` — reported products with delete/dismiss/warn
- [x] `/reports/messages` — reported messages with block/mute/dismiss
- [x] `/reports/communities` — reported communities with ban/warn/dismiss
- [x] `/reports/comments` — reported comments with delete/warn/dismiss
- [x] `/reports/reviews` — reported reviews with delete/warn/dismiss

### ✅ Batch G — Support sub-pages (Complete)
- [x] `/support/live-chat` — real-time chat interface with user list, message history, status indicators
- [x] `/support/[id]` — ticket detail with conversation thread, assign/resolve/close

### ✅ Batch H — Dashboard widgets (Complete)
- [x] Top Cities — progress bars with user counts
- [x] Top Hashtags — tag cloud with styled badges
- [x] Popular Communities — cards with member count and growth badges

### ✅ Batch I — Analytics charts (Complete)
- [x] Orders trend — bar chart
- [x] Products growth — bar chart
- [x] Communities growth — bar chart
- [x] Top Sellers — bar chart
- [x] Top Products — bar chart
- [x] Top Cities — bar chart
- [x] Retention — cohort-style table (W1–W4)
- [x] Heat Maps — activity heatmap grid (24h × 7d)

### ✅ Batch J — Settings tabs (Complete)
- [x] Payments tab — gateway config (Stripe/Razorpay/PayPal) + payout schedule
- [x] Email tab — SMTP config + test email send button
- [x] Storage tab — upload limits, file types, CDN URL, image compression
- [x] API Keys tab — generate/revoke with show/hide toggle
- [x] Maintenance tab — toggle + custom message + estimated return time
- [x] Branding tab — brand color picker, logo URL, custom CSS

### ✅ Batch K — Remaining items (Complete)
- [x] Reviews approve/delete actions — modal dialogs with confirmation
- [x] Review fake detection indicator — AI score badge (Genuine/Suspicious/Fake)
- [x] Categories CRUD modals — create/edit/delete dialogs with form inputs
- [x] Messages chat detail — conversation history dialog with mute/block
- [x] Email notification form — HTML email editor + recipient segment selector
- [x] Audit log filters — action type, admin, date range selectors
- [x] Admin Roles permission matrix — checkbox grid per role (17 modules × 6 actions)

### 🟡 Batch L — Polish (Phase 23)
- [ ] Framer Motion page transitions (fade/slide)
- [ ] Skeleton loaders on entity pages
- [ ] Empty states on all tables
- [ ] Error boundaries
- [ ] Keyboard shortcuts for all pages
- [ ] ARIA labels and WCAG AA compliance
- [ ] Lazy loading and code splitting
- [ ] Dark mode polish

---

## 🐛 Bug Fixes (24 Jul 2026)

### Fix 1: Login redirect loop / 404 after sign in
- **Root cause:** LoginForm used `router.push("/dashboard")` but never set the `auth-token` cookie. Middleware checked for the cookie on `/dashboard/*`, found nothing, and redirected back to `/login`.
- **Fix:** Added `document.cookie = "auth-token=mock-jwt-token; path=/; max-age=86400"` in `login-form.tsx:21` before navigation.

### Fix 2: Route conflict at `/` + all dashboard routes missing `/dashboard` prefix
- **Root cause:** Dashboard routes were inside a route group `(dashboard)/` which Next.js strips from the URL. This caused `app/page.tsx` and `app/(dashboard)/page.tsx` to both map to `/` (conflict), login push to `/dashboard` to 404, and middleware protection of `/dashboard/*` to protect nothing.
- **Fix:** Moved all files from `(dashboard)/` → `dashboard/` (real directory, not route group). All routes now live under `/dashboard/...`. Removed conflicting root `page.tsx`, then recreated with `redirect("/dashboard")`.

### Fix 3: TypeScript build error in Reviews page
- **Root cause:** Plain object `{ id, header, cell }` in `createColumnHelper<Review>()` columns array didn't infer the generic type, causing implicit `any` on `row`.
- **Fix:** Changed display columns to `columnHelper.display({ id, header, cell })`.

### Fix 4: RevenueChart type mismatch in Analytics
- **Root cause:** `ordersTrend` used `{ month, orders }` shape but `RevenueChart` expects `{ month, revenue }`. Y-axis also hardcodes `$` formatter.
- **Fix:** Switched Orders Trend, Products Growth, Communities Growth to `BarChart` with `{ name, value }` shape.
