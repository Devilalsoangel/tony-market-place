"use client";

import { useState } from "react";
import { LoginForm } from "@/components/forms/login-form";
import { Info, X } from "lucide-react";

export default function LoginPage() {
  const [showHint, setShowHint] = useState(true);

  return (
    <div className="rounded-[20px] border border-[#E4E4E7] bg-white p-8 shadow-sm ">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#18181B] ">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your admin account</p>
      </div>
      <LoginForm />
      {showHint && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-dashed border-[#6C3BFF]/30 bg-[#6C3BFF]/5 px-4 py-3 text-xs text-gray-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6C3BFF]" />
          <div className="flex-1">
            <span className="font-semibold text-[#6C3BFF]">Demo:</span>{" "}
            <span className="font-mono">alexrivera</span> /{" "}
            <span className="font-mono">Admin@123</span>{" "}
            <span className="text-gray-400">| 2FA: </span>
            <span className="font-mono">123456</span>
          </div>
          <button
            type="button"
            onClick={() => setShowHint(false)}
            className="ml-1 shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
