"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { cabinetFetch, fetchMe, type FavoriteType } from "./api";

type State = "loading" | "anonymous" | "off" | "on" | "unavailable";

/**
 * «В избранное» для документа, выставки или новости. Анонимному посетителю вместо кнопки — ссылка
 * на кабинет (сайт работает без регистрации); если кабинет недоступен, кнопка не показывается.
 */
export function FavoriteButton({ type, id }: { type: FavoriteType; id: string }) {
  const t = useTranslations("cabinet.favorite");
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if ((await fetchMe()) === null) return active && setState("anonymous");
        const { favorite } = await cabinetFetch<{ favorite: boolean }>(`/favorites/check?type=${type}&id=${id}`);
        if (active) setState(favorite ? "on" : "off");
      } catch {
        if (active) setState("unavailable");
      }
    })();
    return () => {
      active = false;
    };
  }, [type, id]);

  async function toggle() {
    setFailed(false);
    setBusy(true);
    try {
      if (state === "on") await cabinetFetch(`/favorites/${type}/${id}`, { method: "DELETE" });
      else await cabinetFetch("/favorites", { method: "POST", body: { type, id } });
      setState(state === "on" ? "off" : "on");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unavailable") return null;
  if (state === "anonymous") {
    return (
      <Button asChild variant="outline" size="sm" className="h-9">
        <Link href="/cabinet" title={t("signInHint")}>
          <Star aria-hidden /> {t("add")}
        </Link>
      </Button>
    );
  }
  const on = state === "on";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="h-9" onClick={() => void toggle()} disabled={busy} aria-pressed={on}>
        <Star aria-hidden className={on ? "fill-current text-accent" : undefined} />
        {on ? t("added") : t("add")}
      </Button>
      <span role="status" className="sr-only">{on ? t("addedStatus") : ""}</span>
      {failed && <span role="alert" className="text-sm text-destructive">{t("failed")}</span>}
    </span>
  );
}
