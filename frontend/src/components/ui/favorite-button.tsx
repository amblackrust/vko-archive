"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import clsx from "clsx";
import { api, ApiError, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";

/** Saves an item to the visitor's favorites. A red grease circle marks what is saved. */
export function FavoriteButton({ type, id, className }: { type: string; id: string; className?: string }) {
  const t = useTranslations("document");
  const qc = useQueryClient();
  const key = ["favorite", type, id];
  const [needLogin, setNeedLogin] = useState(false);
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api.get<Schema["FavoriteStatus"]>("/api/cabinet/favorites/check", { query: { type, id }, scope: "visitor" }).catch((e) => (e instanceof ApiError && e.status === 401 ? { favorite: false } : Promise.reject(e))),
  });
  const saved = !!data?.favorite;

  const toggle = async () => {
    try {
      if (saved) await api.delete(`/api/cabinet/favorites/${type}/${id}`, { scope: "visitor" });
      else await api.post("/api/cabinet/favorites", { body: { type, id }, scope: "visitor" });
      qc.setQueryData(key, { favorite: !saved });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedLogin(true);
    }
  };

  if (needLogin)
    return <Link href="/cabinet" className={clsx("inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-sm no-underline hover:border-action hover:text-action", className)}>{t("loginToSave")}</Link>;
  return (
    <button type="button" onClick={toggle} aria-pressed={saved} className={clsx("relative inline-flex h-11 items-center gap-2 rounded-full px-5 font-medium transition-[background-color,transform] duration-200 ease-(--ease-spring) active:scale-95", saved ? "text-grease" : "bg-table-3 text-ink hover:brightness-95", className)}>
      <Heart size={16} className={saved ? "fill-current" : ""} aria-hidden />
      {saved ? t("favorited") : t("favorite")}
    </button>
  );
}
