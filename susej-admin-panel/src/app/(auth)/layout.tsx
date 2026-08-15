import { DesktopGuard } from "@/components/layout/desktop-guard";
import { SignedInGuard } from "@/components/layout/signed-in-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SignedInGuard>
      <DesktopGuard>
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-4 ">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </DesktopGuard>
    </SignedInGuard>
  );
}