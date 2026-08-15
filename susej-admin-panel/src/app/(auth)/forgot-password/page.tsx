"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";

type Step = "email" | "otp" | "password" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
        return;
      }
      setDevCode(data?.devCode ?? null);
      setCode("");
      setStep("otp");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", token: code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Invalid code. Try again.");
        return;
      }
      setStep("password");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", token: code, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Reset failed. Try again.");
        return;
      }
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "h-11 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-sm text-[#18181B] outline-none placeholder:text-gray-400 focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20  ";

  const buttonCls =
    "flex h-11 w-full items-center justify-center rounded-xl bg-[#6C3BFF] text-sm font-semibold text-white transition-colors hover:bg-[#5930E6] disabled:opacity-50";

  return (
    <div className="rounded-[20px] border border-[#E4E4E7] bg-white p-8 shadow-sm ">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#18181B] ">Forgot Password</h1>
        <p className="mt-1 text-sm text-gray-500">
          {step === "email" && "Enter your email to receive a verification code"}
          {step === "otp" && "Enter the 6-digit code sent to your email"}
          {step === "password" && "Set a new password"}
          {step === "done" && "Your password has been reset"}
        </p>
      </div>

      {step === "email" && (
        <form onSubmit={sendCode} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#18181B] ">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@admin.com"
                required
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <button type="submit" disabled={loading || !email} className={buttonCls}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Verification Code"}
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

      {step === "otp" && (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-sm text-gray-500">
            We sent a verification code to <strong className="text-[#18181B] ">{email}</strong>. It
            expires in 10 minutes.
          </p>

          {devCode && (
            <p className="rounded-xl border border-[#6C3BFF]/20 bg-[#6C3BFF]/5 p-3 text-center text-sm font-semibold text-[#6C3BFF]">
              No email service - demo code: {devCode}
            </p>
          )}

          <div>
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-[#18181B] ">
              Verification Code
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                required
                className={`${inputCls} pl-9 text-center text-lg font-bold tracking-[0.4em]`}
              />
            </div>
          </div>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <button type="submit" disabled={loading || code.length !== 6} className={buttonCls}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Code"}
          </button>

          <button
            type="button"
            onClick={() => sendCode()}
            disabled={loading}
            className="w-full text-center text-sm text-gray-500 transition-colors hover:text-[#6C3BFF]"
          >
            Resend code
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

      {step === "password" && (
        <form onSubmit={resetPassword} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#18181B] ">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              autoComplete="new-password"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-[#18181B] ">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your new password"
              required
              autoComplete="new-password"
              className={inputCls}
            />
          </div>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <button type="submit" disabled={loading || !password || !confirm} className={buttonCls}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
          </button>

          <button
            type="button"
            onClick={() => setStep("otp")}
            className="w-full text-center text-sm text-gray-500 transition-colors hover:text-[#6C3BFF]"
          >
            Back to code
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#16A34A]/10">
              <CheckCircle2 className="h-8 w-8 text-[#16A34A]" />
            </div>
          </div>
          <p className="mb-6 text-sm text-gray-500">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <Link
            href="/login"
            className="flex h-11 w-full items-center justify-center rounded-xl bg-[#6C3BFF] text-sm font-semibold text-white transition-colors hover:bg-[#5930E6]"
          >
            Back to Sign In
          </Link>
        </div>
      )}
    </div>
  );
}