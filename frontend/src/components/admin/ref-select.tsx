"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { api, type Schema } from "@/lib/api/client";
import { pick } from "./common";

const SOURCES = {
  branch: "/api/admin/catalog/branch-options",
  fund: "/api/admin/catalog/fund",
  inventory: "/api/admin/catalog/inventory",
  case: "/api/admin/catalog/case",
} as const;

/** A select over objects of another type (up to 100). */
export function RefSelect({ kind, value, onChange, id }: { kind: keyof typeof SOURCES; value: string | null; onChange: (v: string | null) => void; id: string }) {
  const t = useTranslations("admin.form");
  const locale = useLocale();
  const { data } = useQuery({
    queryKey: ["admin-ref", kind],
    staleTime: 60_000,
    queryFn: async () => {
      if (kind === "branch") return (await api.get<{ id: string; name: unknown }[]>(SOURCES.branch, { scope: "admin" })).map((b) => ({ id: b.id, label: pick(b.name, locale) }));
      const page = await api.get<Schema["ListPage"]>(SOURCES[kind], { query: { page_size: 100 }, scope: "admin" });
      return page.items.map((i) => ({ id: i.id, label: `${i.number ? i.number + " · " : ""}${pick(i.title, locale)}` }));
    },
  });
  const opts = data ?? [];
  const missing = value && !opts.some((o) => o.id === value);
  return (
    <select id={id} className="field" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{t("none")}</option>
      {missing && <option value={value as string}>{value}</option>}
      {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}
