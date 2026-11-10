"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminProvider, useAdmin } from "./admin-provider";
import { AdminShell } from "./admin-shell";
import { LoginForm } from "./login-form";

function Gate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin.common");
  const { status } = useAdmin();
  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8" role="status" aria-label={t("loading")}>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (status === "anonymous") return <LoginForm />;
  return <AdminShell>{children}</AdminShell>;
}

/** Вся админка за входом: без сессии показывается только форма входа, ни меню, ни данных. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <Gate>{children}</Gate>
    </AdminProvider>
  );
}
