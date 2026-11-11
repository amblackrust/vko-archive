"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Field, SelectField } from "@/components/ui/field";
import type { Branch, BranchType } from "@/lib/api/branches";
import { Link } from "@/lib/i18n/navigation";
import { BranchFacts } from "./branch-facts";
import { BranchMap } from "./branch-map-loader";
import { RoutePanel } from "./route-panel";

const TYPES: BranchType[] = ["head", "district", "city", "personnel"];

/**
 * Карта и список подразделений в одном окне. Слева — поиск и список (полная замена карте);
 * выбор в списке или на карте открывает на месте списка карточку с контактами и маршрутом.
 */
export function BranchesExplorer({ branches }: { branches: Branch[] }) {
  const t = useTranslations("map");
  const locale = useLocale();
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
    <div className="grid gap-6 lg:h-[calc(100dvh-9rem)] lg:max-h-[54rem] lg:min-h-[38rem] lg:grid-cols-[24rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-0 lg:overflow-hidden lg:rounded-lg lg:bg-surface lg:shadow-card">
      {!current && (
        <div className="space-y-3 lg:col-start-1 lg:row-start-1 lg:border-b lg:border-r lg:p-5">
          <Field type="search" label={t("search.label")} placeholder={t("search.placeholder")} value={query} onChange={(event) => setQuery(event.target.value)} />
          <SelectField
            label={t("filter.label")}
            value={type}
            onChange={(event) => setType(event.target.value)}
            options={[{ value: "", label: t("filter.all") }, ...TYPES.map((value) => ({ value, label: t(`types.${value}`) }))]}
          />
        </div>
      )}

      <div className="h-80 overflow-hidden rounded-lg border sm:h-96 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:rounded-none lg:border-0">
        <BranchMap branches={visible} selected={selected} onSelect={setSelected} label={t("map.label")} tileErrorText={t("map.tilesFailed")} />
      </div>

      {current ? (
        <div ref={panel} tabIndex={-1} className="space-y-6 outline-none lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:overflow-y-auto lg:border-r lg:p-5">
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setSelected(null)}>
            <ArrowLeft aria-hidden /> {t("backToList")}
          </Button>
          <div className="space-y-2">
            <h2 className="text-xl" lang={current.name_lang}>{current.name}</h2>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {t(`types.${current.type}`)}
              {current.name_lang !== locale && <DemoBadge kind="noTranslation" />}
            </p>
            {current.description && <p className="text-[0.9375rem]" lang={current.name_lang}>{current.description}</p>}
          </div>
          <BranchFacts branch={current} />
          <RoutePanel key={current.slug} heading="h3" address={current.address} verified={current.coords_verified} point={current.lat != null && current.lng != null ? { lat: current.lat, lng: current.lng } : null} />
          <p><Link href={current.href} className="text-link font-medium">{t("card.details")}</Link></p>
        </div>
      ) : (
        <div className="min-h-0 lg:col-start-1 lg:row-start-2 lg:overflow-y-auto lg:border-r">
          <p role="status" className="text-sm text-muted-foreground lg:px-5 lg:pt-4">{t("count", { count: visible.length })}</p>
          {visible.length === 0 ? (
            <div className="space-y-3 py-6 lg:px-5">
              <p>{t("empty")}</p>
              <Button type="button" variant="outline" className="h-11" onClick={() => { setQuery(""); setType(""); }}>{t("reset")}</Button>
            </div>
          ) : (
            <ul className="mt-3 divide-y rounded-lg bg-surface px-5 shadow-card lg:mt-2 lg:rounded-none lg:bg-transparent lg:px-0 lg:shadow-none">
              {visible.map((b) => (
                <li key={b.slug}>
                  <button
                    type="button"
                    id={`branch-${b.slug}`}
                    onClick={() => setSelected(b.slug)}
                    className="group block w-full py-3 text-left lg:px-5 lg:hover:bg-surface-muted"
                  >
                    <span className="block font-semibold group-hover:text-primary group-hover:underline" lang={b.name_lang}>{b.name}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground" lang={b.name_lang}>{b.address || t("card.missing")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {branches.some((b) => !b.coords_verified) && <p className="py-4 text-sm text-muted-foreground lg:px-5">{t("approxNote")}</p>}
        </div>
      )}
    </div>
  );
}
