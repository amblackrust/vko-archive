"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import type { Resource } from "@/lib/admin-config";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { pick, STATUS_TONE } from "./common";
import { useAdmin } from "./admin-shell";

const STATUSES = ["draft", "review", "needs_changes", "approved", "published", "archived"];

export function ResourceList({ res }: { res: Resource }) {
  const t = useTranslations("admin");
  const d = useTranslations("dict");
  const locale = useLocale();
  const { can } = useAdmin();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const key = res.group === "catalog" ? "catalog" : res.group === "site" ? res.key : "content";
  const canCreate = can(res.group === "catalog" ? "catalog.create" : res.key === "branch" ? "branches.create" : "content.create");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-list", res.key, q, status, page],
    queryFn: () => api.get<Schema["ListPage"]>(res.base, { query: { q, workflow_status: status || undefined, page, page_size: 25 }, scope: "admin" }),
  });
  void key;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl">{t(`res.${res.key}`)}</h1>
        {canCreate && <Link href={`/admin/r/${res.key}/new`} className={buttonClass("primary")}><Plus size={17} aria-hidden /> {t("list.create")}</Link>}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className="field !rounded-full !pl-10" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t("list.search")} aria-label={t("list.search")} />
        </div>
        <select className="field !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={t("list.status")}>
          <option value="">{t("list.all")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{d(`workflow.${s}`)}</option>)}
        </select>
        {data && <span className="text-ink-3">{t("list.total", { count: data.total })}</span>}
      </div>
      {isLoading && <div className="space-y-2" aria-busy>{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-mount-2" />)}</div>}
      {data && data.items.length === 0 && <EmptyState title={t("list.empty")} />}
      {data && data.items.length > 0 && (
        <table className="w-full border-collapse text-left">
          <thead className="text-sm text-ink-3">
            <tr className="border-b border-frame-strong"><th className="w-40 py-2 pr-4 font-semibold max-md:hidden">{t("list.number")}</th><th className="py-2 pr-4 font-semibold">{t("list.name")}</th><th className="w-44 py-2 pr-4 font-semibold">{t("list.status")}</th><th className="w-44 py-2 font-semibold max-lg:hidden">{t("list.updated")}</th></tr>
          </thead>
          <tbody>
            {data.items.map((it) => (
              <tr key={it.id} className="group border-b border-frame">
                <td className="py-3 pr-4 align-top text-sm text-ink-3 max-md:hidden"><Link href={`/admin/r/${res.key}/${it.id}`} className="block no-underline">{it.number}</Link></td>
                <td className="py-3 pr-4"><Link href={`/admin/r/${res.key}/${it.id}`} className="block font-display text-lg font-semibold no-underline group-hover:text-action">{pick(it.title, locale) || "—"}</Link></td>
                <td className="py-3 pr-4 align-top"><Badge tone={STATUS_TONE[it.workflow_status] ?? "neutral"}>{d.has(`workflow.${it.workflow_status}`) ? d(`workflow.${it.workflow_status}`) : it.workflow_status}</Badge></td>
                <td className="tnum py-3 align-top text-sm text-ink-3 max-lg:hidden">{new Date(it.updated_at).toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={buttonClass("secondary", "", "sm")}>{d("pagination.prev")}</button>
          <span className="tnum text-sm text-ink-3">{d("pagination.page", { page, pages })}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className={buttonClass("secondary", "", "sm")}>{d("pagination.next")}</button>
        </div>
      )}
    </div>
  );
}
