"use client";

import { usePathname } from "@/i18n/navigation";

/** Full-screen map pages have no footer below them, so there is nothing to scroll to. */
export function FooterGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === "/branches" || path === "/memory/map" ? null : children;
}
