"use client";
import { HomeManagementProvider } from "@/home-management/context";

export default function HomeManagementLayout({ children }: { children: React.ReactNode }) {
  return <HomeManagementProvider>{children}</HomeManagementProvider>;
}