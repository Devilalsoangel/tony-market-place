import { DashboardShell } from "@/components/layout/dashboard-shell";

// Auth is enforced server-side by src/proxy.ts (the session cookie is
// httpOnly, so a client-side document.cookie check can never see it - the
// previous AuthGate wrapper concluded "logged out" on EVERY dashboard page,
// bounced to /login, and the proxy immediately redirected back to
// /dashboard, making every deep link land on the overview page).
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}