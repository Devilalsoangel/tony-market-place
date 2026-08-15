"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          borderRadius: "14px",
          border: "1px solid #E4E4E7",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        },
      }}
    />
  );
}

export { toast } from "sonner";
