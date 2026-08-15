"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";

export default function TwoFactorPageWrapper() {
  return (
    <Suspense fallback={null}>
      <TwoFactorPage />
    </Suspense>
  );
}

function TwoFactorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [codes, setCodes] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const target = searchParams.get("from") || "/dashboard";

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCodes = [...codes];
    newCodes[index] = value;
    setCodes(newCodes);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const code = codes.join("");
      const res = await fetch("/api/login/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.user) {
        setError(data?.error ?? "Invalid code. Try again.");
        setLoading(false);
        return;
      }
      setAuth(data.user, data.token);
      router.push(target);
    } catch {
      setError("Verification failed. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[20px] border border-[#E4E4E7] bg-white p-8 shadow-sm ">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#18181B] ">Two-Factor Auth</h1>
        <p className="mt-1 text-sm text-gray-500">Enter the code from your authenticator app</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center gap-2">
          {codes.map((code, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              maxLength={1}
              value={code}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-14 w-12 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-center text-lg font-bold text-[#18181B] outline-none focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20  "
            />
          ))}
        </div>

        {error && <p className="text-center text-sm text-[#EF4444]">{error}</p>}

        <button
          type="submit"
          disabled={loading || codes.some((c) => !c)}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[#6C3BFF] text-sm font-semibold text-white transition-colors hover:bg-[#5930E6] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
        </button>

        <Link
          href="/login"
          className="flex items-center justify-center gap-1 text-sm text-gray-500 transition-colors hover:text-[#18181B] "
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to login
        </Link>
      </form>
    </div>
  );
}