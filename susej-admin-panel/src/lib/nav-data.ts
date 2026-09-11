import {
  LayoutDashboard,
  Home,
  Store,
  Package,
  Tags,
  ShoppingCart,
  Gavel,
  Boxes,
  UtensilsCrossed,
  CalendarCheck,
  TicketPercent,
  Truck,
  Users,
  UserCheck,
  Ban,
  MapPin,
  UsersRound,
  Newspaper,
  Images,
  Clapperboard,
  Radio,
  RadioTower,
  Star,
  Hash,
  MessageCircle,
  CreditCard,
  Wallet,
  RotateCcw,
  Scale,
  Gift,
  Banknote,
  Percent,
  Headphones,
  Bell,
  Flag,
  BarChart3,
  Download,
  Settings,
  ShieldCheck,
  ScrollText,
  Server,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export interface NavModule {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

export const MODULES: NavModule[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Home Management", href: "/dashboard/home-management", icon: Home },
    ],
  },
  {
    id: "commerce",
    label: "Commerce",
    icon: Store,
    items: [
      { label: "Products", href: "/dashboard/products", icon: Package },
      { label: "Categories", href: "/dashboard/categories", icon: Tags },
      { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
      { label: "Auctions", href: "/dashboard/auctions", icon: Gavel },
      { label: "Bundles", href: "/dashboard/bundles", icon: Boxes },
      { label: "Food Hub", href: "/dashboard/food-hub", icon: UtensilsCrossed },
      { label: "Bookings & Services", href: "/dashboard/bookings", icon: CalendarCheck },
      { label: "Offers & Coupons", href: "/dashboard/offers", icon: TicketPercent },
      { label: "Shipping", href: "/dashboard/shipping", icon: Truck },
    ],
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    items: [
      { label: "Users", href: "/dashboard/users", icon: Users },
      { label: "Seller Verification", href: "/dashboard/sellers", icon: UserCheck },
      { label: "Blocked & Banned", href: "/dashboard/blocked", icon: Ban },
      { label: "Address Book", href: "/dashboard/address-book", icon: MapPin },
    ],
  },
  {
    id: "social",
    label: "Social & Content",
    icon: UsersRound,
    items: [
      { label: "Communities", href: "/dashboard/communities", icon: UsersRound },
      { label: "Posts & Moderation", href: "/dashboard/posts", icon: Newspaper },
      { label: "Stories", href: "/dashboard/stories", icon: Images },
      { label: "Reels", href: "/dashboard/reels", icon: Clapperboard },
      { label: "Live", href: "/dashboard/live", icon: Radio },
      { label: "Broadcasts", href: "/dashboard/broadcasts", icon: RadioTower },
      { label: "Reviews & Ratings", href: "/dashboard/reviews", icon: Star },
      { label: "Hashtags", href: "/dashboard/hashtags", icon: Hash },
      { label: "Messages & Chat", href: "/dashboard/messages", icon: MessageCircle },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: CreditCard,
    items: [
      { label: "Payments", href: "/dashboard/payments", icon: CreditCard },
      { label: "Promotions & Ads", href: "/dashboard/promotions", icon: Banknote },
      { label: "Commission & Fees", href: "/dashboard/commission", icon: Percent },
      { label: "Wallet", href: "/dashboard/wallet", icon: Wallet },
      { label: "Refunds", href: "/dashboard/refunds", icon: RotateCcw },
      { label: "Disputes", href: "/dashboard/disputes", icon: Scale },
      { label: "Loyalty & Referrals", href: "/dashboard/loyalty", icon: Gift },
      { label: "Payment Methods", href: "/dashboard/payment-methods", icon: Banknote },
    ],
  },
  {
    id: "operations",
    label: "Operations & Support",
    icon: Headphones,
    items: [
      { label: "Support Tickets", href: "/dashboard/support", icon: Headphones },
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      { label: "Reports Queue", href: "/dashboard/reports-queue", icon: Flag },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "Export Center", href: "/dashboard/export-center", icon: Download },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    items: [
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
      { label: "Admins", href: "/dashboard/admins", icon: ShieldCheck },
      { label: "Audit Logs", href: "/dashboard/audit-logs", icon: ScrollText },
      { label: "System", href: "/dashboard/system", icon: Server },
    ],
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return MODULES.flatMap((m) => m.items)
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
