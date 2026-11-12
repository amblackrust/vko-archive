"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { usePathname, useRouter } from "@/i18n/navigation";
import { periodLabel } from "@/lib/format";
import type { Schema } from "@/lib/api/client";

type Facets = Required<Pick<Schema["SearchFacets"], "doc_type" | "period" | "branch">>;
const KEYS = { doc_type: "doc_type", period: "period", branch: "branch_id" } as const;

/** Facet toggles written to the URL; the server re-renders the results. */
export function FacetBar({ facets }: { facets: Facets }) {
  const t = useTranslations("search.filters");
  const d = useTranslations("dict");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const toggle = (param: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    const current = next.getAll(param);
    next.delete(param);
    next.delete("offset");
    (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]).forEach((v) => next.append(param, v));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const groups = [
    { id: "doc_type", title: t("docType"), items: facets.doc_type, label: (v: string, l?: string | null) => l ?? (d.has(`docType.${v}`) ? d(`docType.${v}`) : v) },
    { id: "period", title: t("period"), items: facets.period, label: (v: string) => periodLabel(v, d("periodSuffix")) },
    { id: "branch", title: t("branch"), items: facets.branch, label: (v: string, l?: string | null) => l ?? v },
  ] as const;

  return (
    <div className="mb-8 space-y-3">
      {groups.map((g) =>
        g.items.length > 1 || params.getAll(KEYS[g.id]).length ? (
          <div key={g.id} className="flex flex-wrap items-center gap-2">
            <span className="w-32 shrink-0 text-sm text-ink-3">{g.title}</span>
            {g.items.map((it) => {
              const on = params.getAll(KEYS[g.id]).includes(it.value);
              return (
                <button
                  key={it.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(KEYS[g.id], it.value)}
                  className={clsx(
                    "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-[background-color,color,transform,border-color] duration-200 ease-(--ease-spring) active:scale-95",
                    on ? "border-action bg-action text-action-ink" : "border-line-strong/60 bg-panel/60 text-ink-2 hover:border-action hover:text-action",
                  )}
                >
                  {g.label(it.value, it.label)}
                  <span className={clsx("tnum text-xs", on ? "opacity-80" : "text-ink-3")}>{it.count}</span>
                </button>
              );
            })}
          </div>
        ) : null,
      )}
    </div>
  );
}
