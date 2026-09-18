"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Session watchdog: the edge proxy honors token signatures for 24h, so ban /
 * demote only bites data APIs until expiry — open tabs keep navigating desks
 * that render empty/error. Poll the live session (60s + tab focus); the
 * moment it dies, drop to /login instead of a lying dashboard.
 */
export function SessionWatchdog() {
  const router = useRouter();
  const dead = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const check = async () => {
      if (dead.current || cancelled || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/session", { cache: "no-store", credentials: "include" });
        if (!res.ok && !cancelled) {
          dead.current = true;
          // Clear the dead cookie FIRST: /login bounces signed tokens back
          // to /dashboard (proxy), which would loop without this.
          try {
            await fetch("/api/logout", { method: "POST", credentials: "include" });
          } catch {}
          if (!cancelled) router.replace("/login?from=revoked");
        }
      } catch {
        // Offline/transient — never log out on a failed probe; the data
        // layer surfaces its own errors. Next tick retries.
      }
    };
    timer = setInterval(check, 60000);
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  return null;
}
