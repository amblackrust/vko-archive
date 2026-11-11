"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsNav } from "@/components/ui/tabs-nav";
import { AccountPanel } from "./account-panel";
import { cabinetFetch, fetchMe, type VisitorMe } from "./api";
import { AuthForm } from "./auth-form";
import { errorCode } from "./form";
import { FavoritesPanel, SearchesPanel, SelectionsPanel, SubscriptionsPanel } from "./panels";
import { SECTIONS, type Section } from "./sections";

const FEATURES = ["favorites", "selections", "searches", "subscriptions"] as const;

type State = { status: "loading" } | { status: "unavailable" } | { status: "anonymous" } | { status: "user"; me: VisitorMe };

/** Кабинет посетителя: без входа — форма и пояснение, после входа — рабочие разделы вкладками (раздел в адресе: ?section=…). */
export function CabinetApp({ section }: { section: Section }) {
  const t = useTranslations("cabinet");
  const [state, setState] = useState<State>({ status: "loading" });

  function load() {
    setState({ status: "loading" });
    fetchMe().then(
      (me) => setState(me ? { status: "user", me } : { status: "anonymous" }),
      () => setState({ status: "unavailable" }),
    );
  }
  useEffect(load, []);

  async function logout() {
    try {
      await cabinetFetch("/auth/logout", { method: "POST" });
    } finally {
      setState({ status: "anonymous" });
    }
  }

  if (state.status === "loading") {
    return (
      <div role="status" aria-label={t("loading")} className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (state.status === "unavailable") {
    return (
      <div className="max-w-2xl space-y-4">
        <Notice tone="warning" title={t("unavailable.title")}>{t("unavailable.text")}</Notice>
        <Button variant="outline" onClick={load}>{t("unavailable.retry")}</Button>
      </div>
    );
  }
  if (state.status === "anonymous") {
    return (
      <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <AuthForm onSignedIn={(me) => setState({ status: "user", me })} />
        <aside className="max-w-xl space-y-4">
          <h2 className="text-xl">{t("features.title")}</h2>
          <ul className="card divide-y px-5">
            {FEATURES.map((feature) => (
              <li key={feature} className="py-3">
                <p className="font-semibold">{t(`sections.${feature}`)}</p>
                <p className="text-sm text-muted-foreground">{t(`features.${feature}`)}</p>
              </li>
            ))}
          </ul>
          <Notice>{t("noRequests")}</Notice>
        </aside>
      </div>
    );
  }

  const { me } = state;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 card px-4 py-3 sm:px-5">
        <p className="min-w-0">
          <span className="block text-sm text-muted-foreground">{t("signedInAs")}</span>
          <span className="break-words font-semibold">{me.display_name || me.email}</span>
          {me.display_name && <span className="break-all text-muted-foreground"> · {me.email}</span>}
        </p>
        <Button variant="outline" size="sm" onClick={() => void logout()}>{t("logout")}</Button>
      </div>
      {!me.email_confirmed && <EmailBanner />}
      <TabsNav label={t("sectionsLabel")} active={section} items={SECTIONS.map((id) => ({ id, label: t(`sections.${id}`), href: id === SECTIONS[0] ? "/cabinet" : `/cabinet?section=${id}` }))} />
      {section === "favorites" && <FavoritesPanel />}
      {section === "selections" && <SelectionsPanel />}
      {section === "searches" && <SearchesPanel />}
      {section === "subscriptions" && <SubscriptionsPanel />}
      {section === "account" && <AccountPanel me={me} onDeleted={() => setState({ status: "anonymous" })} />}
    </div>
  );
}

/** Повторная отправка письма с подтверждением адреса; результат объявляется рядом с кнопкой. */
export function ResendEmail() {
  const t = useTranslations("cabinet");
  const locale = useLocale();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    setResult(null);
    try {
      await cabinetFetch("/auth/email/resend", { method: "POST", body: { lang: locale } });
      setResult({ ok: true, text: t("email.sent") });
    } catch (caught) {
      setResult({ ok: false, text: t(`errors.${errorCode(caught)}`) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" onClick={() => void resend()} disabled={busy}>{t("email.resend")}</Button>
      {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm" : "text-sm text-destructive"}>{result.text}</p>}
    </div>
  );
}

function EmailBanner() {
  const t = useTranslations("cabinet");
  return (
    <Notice tone="warning" title={t("email.unconfirmedTitle")}>
      <p>{t("email.unconfirmedText")}</p>
      <div className="mt-3"><ResendEmail /></div>
    </Notice>
  );
}
