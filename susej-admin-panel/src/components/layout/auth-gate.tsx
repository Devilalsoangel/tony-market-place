"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const hasSession = document.cookie.split(";").some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
    if (!hasSession) router.replace("/login");
  }, [router]);

  return <>{children}</>;
}