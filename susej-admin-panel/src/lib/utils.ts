import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, format: "short" | "long" | "relative" = "short"): string {
  const d = new Date(date);
  if (format === "relative") {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (days < 30) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    if (days < 365) return months === 1 ? '1 month ago' : `${months} months ago`;
    const years = Math.floor(days / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }
  return d.toLocaleDateString("en-US", {
    month: format === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCurrency(amount: number): string {
  // susej is an Indian marketplace — every money column renders INR.
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}
