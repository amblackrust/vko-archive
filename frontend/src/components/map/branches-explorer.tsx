"use client";

import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import type { Branch, BranchType } from "@/lib/api/branches";
import { Link } from "@/lib/i18n/navigation";
import { BranchFacts } from "./branch-facts";
import { BranchMap } from "./branch-map-loader";
import { MapLinks } from "./map-links";
import { mapQuery } from "./route-links";

const TYPES: BranchType[] = ["head", "district", "city", "personnel"];

/**
 * Карта и список подразделений одним окном на высоту экрана. Слева — поиск и список (полная замена карте);
 * выбор в списке или на карте открывает на месте списка карточку: контакты, внешние карты и переход на страницу филиала.
 */
export function BranchesExplorer({ branches }: { branches: Branch[] }) {
  const t = useTranslations("map");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lastSelected = useRef<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return branches.filter((b) => (!type || b.type === type) && (!needle || `${b.name} ${b.address}`.toLowerCase().includes(needle)));
  }, [branches, query, type]);
  const current = branches.find((b) => b.slug === selected);

  // Фокус следует за выбором: карточку читает экранный диктор и она попадает в поле зрения на телефоне;
  // при возврате фокус встаёт на ту же строку списка.
  useEffect(() => {
    if (selected) panel.current?.focus();
    else if (lastSelected.current) document.getElementById(`branch-${lastSelected.current}`)?.focus();
    lastSelected.current = selected;
  }, [selected]);

  return (
    <div className="grid gap-6 lg:h-[calc(100dvh-15.75rem)] lg:min-h-[34rem] lg:grid-cols-[25rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-0 lg:overflow-hidden lg:rounded-3xl lg:bg-surface lg:shadow-card">
      {!current && (
        <div className="grid gap-3 sm:grid-cols-2 lg:col-start-1 lg:row-start-1 lg:grid-cols-1 lg:border-b lg:border-r lg:p-6">
          <Field type="search" label={t("search.label")} placeholder={t("search.placeholder")} value={query} onChange={(event) => setQuery(event.target.value)} />
          <SelectField
            label={t("filter.label")}
            value={type}
            onChange={(event) => setType(event.target.value)}
            options={[{ value: "", label: t("filter.all") }, ...TYPES.map((value) => ({ value, label: t(`types.${value}`) }))]}
          />
        </div>
      )}

      <div className="h-80 overflow-hidden rounded-2xl shadow-card sm:h-96 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:rounded-none lg:shadow-none">
        <BranchMap branches={visible} selected={selected} onSelect={setSelected} label={t("map.label")} tileErrorText={t("map.tilesFailed")} />
      </div>

      {current ? (
        // key: без него React переиспользует узел списка вместе с его прокруткой.
        <div key="card" ref={panel} tabIndex={-1} className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-card outline-none lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:rounded-none lg:border-r lg:bg-transparent lg:shadow-none">
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 lg:overflow-y-auto lg:px-6 lg:pb-6 lg:pt-4">
            <div>
              <Button type="button" variant="ghost" size="sm" className="-ml-3 min-h-11 text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>
                <ArrowLeft aria-hidden /> {t("backToList")}
              </Button>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t(`types.${current.type}`)}</p>
              <h2 className="mt-1 text-2xl leading-tight" lang={current.name_lang}>{current.name}</h2>
              {current.description && <p className="mt-2 text-[0.9375rem] text-muted-foreground" lang={current.name_lang}>{current.description}</p>}
            </div>
            <BranchFacts branch={current} />
            <div className="space-y-3">
              <h3 className="text-base">{t("route.title")}</h3>
              <MapLinks destination={current.coords_verified && current.lat != null && current.lng != null ? `${current.lat},${current.lng}` : mapQuery(current.address)} />
            </div>
          </div>
          <div className="border-t p-5 lg:px-6 lg:py-4">
            <Button asChild size="lg" className="w-full">
              <Link href={current.href}>{t("card.details")} <ArrowRight aria-hidden /></Link>
            </Button>
          </div>
        </div>
      ) : (
        <div key="list" className="min-h-0 lg:col-start-1 lg:row-start-2 lg:overflow-y-auto lg:border-r">
          <p role="status" className="text-sm text-muted-foreground lg:px-6 lg:pt-4">{t("count", { count: visible.length })}</p>
          {visible.length === 0 ? (
            <div className="space-y-3 py-6 lg:px-6">
              <p>{t("empty")}</p>
              <Button type="button" variant="outline" className="h-11" onClick={() => { setQuery(""); setType(""); }}>{t("reset")}</Button>
            </div>
          ) : (
            <ul aria-label={t("list")} className="mt-3 divide-y overflow-hidden rounded-2xl bg-surface shadow-card lg:mt-2 lg:rounded-none lg:bg-transparent lg:shadow-none">
              {visible.map((b) => (
                <li key={b.slug}>
                  <button
                    type="button"
                    id={`branch-${b.slug}`}
                    onClick={() => setSelected(b.slug)}
                    className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-muted lg:px-6"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug group-hover:text-primary" lang={b.name_lang}>{b.name}</span>
                      {b.address && <span className="mt-1 block text-sm text-muted-foreground" lang={b.name_lang}>{b.address}</span>}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
