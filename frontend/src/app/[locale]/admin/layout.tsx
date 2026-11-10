import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";

// Админка не индексируется и не кэшируется поисковиками.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
