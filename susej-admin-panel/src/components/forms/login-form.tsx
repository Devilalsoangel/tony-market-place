"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const loginId = String(form.get("loginId") || "").trim();
    const password = String(form.get("password") || "");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error ?? "Login failed. Please try again.");
        setLoading(false);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from") || "/dashboard";
      if (data.twoFactor) {
        router.push(`/login/2fa?from=${encodeURIComponent(from)}`);
        return;
      }
      if (!data.user) {
        setError("Login failed. Please try again.");
        setLoading(false);
        return;
      }
      setAuth(data.user);
      router.push(from);
    } catch {
      setError("Login failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="loginId" className="mb-1.5 block text-sm font-medium text-[#18181B] ">
          Admin ID
        </label>
        <input
          id="loginId"
          name="loginId"
          type="text"
          placeholder="e.g. alexrivera"
          required
          autoComplete="username"
          className="h-11 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-sm text-[#18181B] outline-none placeholder:text-gray-400 focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20  "
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#18181B] ">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            className="h-11 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-4 pr-10 text-sm text-[#18181B] outline-none placeholder:text-gray-400 focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20  "
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#EF4444]">{error}</p>
      )}

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-[#6C3BFF] transition-colors hover:text-[#5930E6]">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-[#6C3BFF] text-sm font-semibold text-white transition-colors hover:bg-[#5930E6] disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
      </button>
    </form>
  );
}
