"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cabinetFetch, fetchMe, type VisitorMe } from "./api";
import { AuthForms } from "./auth-forms";
import { EmailBanner } from "./email-banner";
import { FavoritesPanel } from "./favorites-panel";
import { PasswordPanel } from "./password-panel";
import { SearchesPanel } from "./searches-panel";
import { SelectionsPanel } from "./selections-panel";
import { SubscriptionsPanel } from "./subscriptions-panel";

type State = { status: "loading" } | { status: "unavailable" } | { status: "anonymous" } | { status: "user"; me: VisitorMe };

export function CabinetApp() {
  const t = useTranslations("cabinet");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetchMe().then(
      (me) => active && setState(me ? { status: "user", me } : { status: "anonymous" }),
      () => active && setState({ status: "unavailable" }),
    );
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    try {
      await cabinetFetch("/auth/logout", { method: "POST" });
    } finally {
      setState({ status: "anonymous" });
    }
  }

  async function deleteAccount() {
    if (!window.confirm(t("auth.deleteConfirm"))) return;
    await cabinetFetch("/me", { method: "DELETE" });
    setState({ status: "anonymous" });
  }

  if (state.status === "loading") return <Skeleton className="h-40 w-full" />;
  if (state.status === "unavailable") return <p role="alert" className="text-muted-foreground">{t("unavailable")}</p>;
  if (state.status === "anonymous") return <AuthForms onSignedIn={(me) => setState({ status: "user", me })} />;

  return (
    <div className="space-y-8">
      {state.me.email_confirmed === false && <EmailBanner />}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface p-4">
        <p>{t("auth.signedInAs", { name: state.me.display_name || state.me.email })}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={logout}>{t("auth.logout")}</Button>
          <Button variant="ghost" size="sm" onClick={() => void deleteAccount()}>{t("auth.deleteAccount")}</Button>
        </div>
      </div>
      <FavoritesPanel />
      <SelectionsPanel />
      <SearchesPanel />
      <SubscriptionsPanel />
      <PasswordPanel />
    </div>
  );
}
