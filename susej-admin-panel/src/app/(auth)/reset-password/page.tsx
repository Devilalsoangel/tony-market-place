"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, CheckCircle2 } from "lucide-react";
import Link from "next/link";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [checking, setChecking] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [checkedOnce, setCheckedOnce] = useState(false);

  useEffect(() => {
    if (checkedOnce) return;
    setCheckedOnce(true);
    (async () => {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", token }),
      });
      const data = await res.json().catch(() => null);
      setChecking(false);
      if (!data?.ok) {
        setInvalid(true);
        return;
      }
      setAdminName(data.adminName ?? "");
    })().catch(() => {
      setChecking(false);
      setInvalid(true);
    });
  }, [checkedOnce, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", token, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Reset failed. Try again.");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Reset failed. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[20px] border border-[#E4E4E7] bg-white p-8 shadow-sm ">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#18181B] ">
          {done ? "Password Updated" : invalid ? "Reset Link Expired" : "Create New Password"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {done
            ? "Your password has been changed successfully."
            : invalid
              ? "This reset link is invalid or has already been used."
              : checking
                ? "Verifying your link..."
                : adminName
                  ? `Set a new password for ${adminName}`
                  : "Set a new password for your account"}
        </p>
      </div>

      {done ? (
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#16A34A]/10">
              <CheckCircle2 className="h-8 w-8 text-[#16A34A]" />
            </div>
          </div>
          <Link
            href="/login"
            className="flex h-11 w-full items-center justify-center rounded-xl bg-[#6C3BFF] text-sm font-semibold text-white transition-colors hover:bg-[#5930E6]"
          >
            Sign In
          </Link>
        </div>
      ) : invalid ? (
        <Link
          href="/forgot-password"
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[#6C3BFF] text-sm font-semibold text-white transition-colors hover:bg-[#5930E6]"
        >
          Request a new link
        </Link>
      ) : checking ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-[#6C3BFF]" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#18181B] ">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] pl-10 pr-4 text-sm text-[#18181B] outline-none placeholder:text-gray-400 focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20  "
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-[#18181B] ">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                required
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] pl-10 pr-4 text-sm text-[#18181B] outline-none placeholder:text-gray-400 focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20  "
              />
            </div>
          </div>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-[#6C3BFF] text-sm font-semibold text-white transition-colors hover:bg-[#5930E6] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
          </button>

          <Link
            href="/login"
            className="flex items-center justify-center gap-1 text-sm text-gray-500 transition-colors hover:text-[#18181B] "
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#6C3BFF]" /></div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}