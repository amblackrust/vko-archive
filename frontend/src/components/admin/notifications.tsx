"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";

export function Notifications({ onClose }: { onClose: () => void }) {
  const t = useTranslations("admin.notif");
  const locale = useLocale() as "kk" | "ru" | "en";
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-notif"], queryFn: () => api.get<Schema["NotificationList"]>("/api/admin/notifications", { scope: "admin", background: true }) });
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const items = data?.items ?? [];
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,90vw)] rounded-2xl border border-frame bg-paper p-3 shadow-lift-high">
      <div className="mb-2 flex items-center justify-between px-2"><h2 className="text-lg font-bold">{t("title")}</h2><button type="button" className="text-sm text-action" onClick={async () => { await api.post("/api/admin/notifications/read-all", { scope: "admin" }); void qc.invalidateQueries({ queryKey: ["admin-notif"] }); }}>{t("readAll")}</button></div>
      {items.length === 0 && <p className="px-2 py-4 text-ink-3">{t("none")}</p>}
      <ul className="max-h-[60vh] overflow-y-auto">
        {items.map((n) => (
          <li key={n.id}><Link href={n.object_type && n.object_id ? `/admin/r/${n.object_type}/${n.object_id}` : "/admin"} onClick={onClose} className={clsx("block rounded-xl px-2 py-2.5 no-underline hover:bg-mount-2", !n.is_read && "font-semibold")}>{(n.message as Record<string, string>)[locale] ?? Object.values(n.message as Record<string, string>)[0]}</Link></li>
        ))}
      </ul>
    </div>
  );
}
