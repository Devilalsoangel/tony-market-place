"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export function SignedInGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (document.cookie.split(";").some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`))) {
      router.replace("/dashboard");
    }
  }, [router]);

  return <>{children}</>;
}