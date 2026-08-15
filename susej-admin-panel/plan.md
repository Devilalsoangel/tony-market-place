# SUSEJ Admin Panel — Marketplace Operations Dashboard

## Overview

Transform Safari Admin into a professional Marketplace Operations Dashboard while preserving the existing design system, purple theme, layout, typography, and reusable components.

**Golden Rules:**
- Keep existing design language
- Keep purple theme (`#6C3BFF`, `#151A2D`)
- Do NOT redesign the whole admin panel
- Do NOT modify unrelated modules
- Do NOT break existing functionality
- Reuse existing UI components whenever possible
- Build production-ready UI
- Keep everything API-ready (mock data is acceptable)
- Build module by module, review before moving on

---

## Implementation Order

### PHASE 1 — Seller Verification
**Status:** ✅ Complete

**Changes:**
- Extended Seller type with documents, audit logs, contact info
- Rich mock data with uploaded documents and audit history
- Tabbed main page: All / Pending Queue / Verified / Rejected
- Verification Workspace (`[id]/page.tsx`): Business Info, Checklist, Documents, Actions, Timeline
- New components: DocumentViewer, VerificationChecklist, AdminActionBar, AuditTimeline

### PHASE 2 — Category Management
**Status:** ✅ Complete

**Improvements:**
- Category hierarchy with parent category
- Auto-generated slug
- Description field
- Icon picker
- Banner image
- Featured toggle
- Active/Hidden status
- Product count display
- Sort order
- Nested categories (tree view)
- SEO fields (Meta Title & Meta Description)

### PHASE 3 — Community Moderation
**Status:** ❌ Not Started

**Features:**
- Community Details view
- Reported Posts moderation
- Reported Comments moderation
- Moderation Queue
- Member Management (view, remove, ban, promote)
- Suspend / Ban / Hide / Delete community
- Lock Posting / Disable Comments
- Activity Timeline
- Reports: View / Hide / Delete / Warn User / Dismiss

### PHASE 4 — Notification Builder
**Status:** ❌ Not Started

**Features:**
- Push Notifications
- Email Notifications
- Announcement Banner Builder
- Audience Selector (All Users, Buyers, Sellers, Verified Sellers, Selected Users)
- Ready-made Templates (Welcome, Seller Approved, Seller Rejected, Order Delivered, Promotion, Password Reset, Weekly Newsletter)
- Live Preview (admins edit content, HTML auto-generated)
- Schedule sending
- Save Draft
- Send Now
- Notification History

### PHASE 5 — Sidebar + Subscriptions
**Status:** ❌ Not Started

**Sidebar sections:**
- MAIN: Dashboard
- MARKETPLACE: Users, Seller Verification, Products, Categories, Orders
- COMMUNITY: Communities, Reviews
- OPERATIONS: Subscriptions, Support, Notifications
- INSIGHTS: Analytics
- SYSTEM: Settings (Admin Roles, Audit Logs, Integrations, General Settings)

**Subscription Management:**
- Plans (Create, Edit, Archive, Monthly/Yearly Pricing, Trial)
- Subscribers (Active, Expired, Cancelled)
- Coupons (Percentage/Fixed Discount, Expiry, Usage Limit)
- Revenue Dashboard (Monthly/Annual Revenue, Active Subscribers, Renewals, Churn Rate)

### PHASE 6 — Auth + Database Backend
**Status:** ✅ Complete

**Changes:**
- SQLite database (better-sqlite3) with seed script `scripts/seed.ts`
- `lib/db.ts` (query helpers) + `lib/auth.ts` (cryptographic password hashing, session validation)
- Auth API: login, 2FA verification, logout, admin creation
- Login page with 2FA step, forgot-password flow
- Middleware proxy guard: protected routes redirect to `/login?from=` when unauthenticated
- Generic `/api/db/[resource]` CRUD + `useDbResource` hook for client-side data access
- Pages migrated off mock data: Dashboard, Users, User detail, Products, Subscriptions, Orders
- Enrolled seed users (uniquified emails) + admin `alexrivera` / `Admin@123`
- `.env` toggles: `SEED_ENROLLED`, `API_MOCK_DELAY`, `ADMIN_ORIGIN`

---

## UI/UX Principles

- Focus on workflows instead of static tables
- Every approval/rejection/moderation gets a dedicated detail page
- Use existing Card, Badge, Button, Dialog, Tabs, DataTable, Avatar, Breadcrumb, Switch, Progress, Separator components
- Keep responsive layouts
- Use modern UX patterns
