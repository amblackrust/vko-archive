"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminProvider, useAdmin } from "./admin-provider";
import { AdminShell } from "./admin-shell";
import { ToastProvider } from "./kit/toast";
import { LoginForm } from "./login-form";

function Gate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin.common");
  const { status } = useAdmin();
  if (status === "loading") {
    return (
      <div className="min-h-screen p-6" role="status" aria-label={t("loading")}>
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-8 w-1/3 bg-border" />
          <Skeleton className="h-40 w-full bg-border" />
        </div>
      </div>
    );
  }
  if (status === "anonymous") return <LoginForm />;
  return (
    <ToastProvider>
      <AdminShell>{children}</AdminShell>
    </ToastProvider>
  );
}

/** Вся админка за входом: без сессии показывается только форма входа, ни меню, ни данных. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <Gate>{children}</Gate>
    </AdminProvider>
  );
}
