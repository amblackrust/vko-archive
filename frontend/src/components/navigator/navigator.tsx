"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { API_URL } from "@/lib/api/client";
import type { FundItem, List } from "@/lib/api/catalog";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const GOALS = ["work", "study", "family", "research"] as const;
type Goal = (typeof GOALS)[number];

/** Годы действия названия из строки источника: «24.06.1992-01.1996», «28.08.2001-», «[03]1926-19.02.1932». */
function yearRange(dates: string | null): [number, number] | null {
  const years = (dates?.match(/\d{4}/g) ?? []).map(Number);
  if (years.length === 0) return null;
  const open = /-\s*$/.test(dates ?? "");
  return [years[0], open ? Infinity : years[years.length - 1]];
}

/** Как называлась организация в указанном году — это название и пишут в заявлении. */
function nameInYear(fund: FundItem, year: number): string | null {
  const match = fund.former_names.find((entry) => {
    const range = yearRange(entry.dates);
    return range !== null && range[0] <= year && year <= range[1];
  });
  return match?.name ?? null;
}

function Step({ number, title, done, children }: { number: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("border-t-2 pt-5", done ? "border-primary" : "border-border-strong")}>
      <h2 className="flex items-baseline gap-3 text-xl">
        <span className="text-base font-semibold tabular-nums text-primary">{number}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </li>
  );
}

/**
 * Навигатор: цель → организация → что делать. Только подсказывает, где хранятся документы и куда обращаться;
 * заявления на сайте не принимаются. Поиск фонда идёт по открытому каталогу (включая прежние названия).
 */
export function Navigator() {
  const t = useTranslations("navigator");
  const locale = useLocale();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [query, setQuery] = useState("");
  const [funds, setFunds] = useState<FundItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [fund, setFund] = useState<FundItem | null>(null);
  const [year, setYear] = useState("");

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setFunds(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/catalog/funds?${new URLSearchParams({ q: text, per_page: "6", lang: locale })}`, { signal: controller.signal })
        .then((response) => (response.ok ? (response.json() as Promise<List<FundItem>>) : Promise.reject(new Error(String(response.status)))))
        .then((data) => {
          setFunds(data.items.filter((item) => !item.is_demo));
          setFailed(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale]);

  const yearNumber = /^\d{4}$/.test(year) ? Number(year) : null;
  const nameThen = fund && yearNumber ? nameInYear(fund, yearNumber) : null;
  const needsCertificate = goal === "work" || goal === "study";

  return (
    <ol className="space-y-10">
      <Step number={1} title={t("goal.title")} done={goal !== null}>
        <div role="radiogroup" aria-label={t("goal.title")} className="grid gap-3 sm:grid-cols-2">
          {GOALS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={goal === id}
              onClick={() => setGoal(id)}
              className={cn("min-h-16 card p-4 text-left", goal === id ? "border-primary bg-surface-muted" : "border-border-strong hover:border-primary")}
            >
              <span className="block font-semibold">{t(`goal.${id}.title`)}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{t(`goal.${id}.text`)}</span>
            </button>
          ))}
        </div>
      </Step>

      {goal && (
        <Step number={2} title={t(goal === "family" ? "fund.titleFamily" : "fund.title")} done={fund !== null}>
          <label htmlFor="navigator-q" className="block text-sm font-medium">{t("fund.label")}</label>
          <Input id="navigator-q" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setFund(null); }} placeholder={t("fund.placeholder")} autoComplete="off" className="mt-1 h-11 max-w-2xl text-base" />
          <p className="mt-1 text-sm text-muted-foreground">{t("fund.hint")}</p>
          <div aria-live="polite" className="mt-4 max-w-3xl">
            {failed && <p role="alert">{t("fund.failed")}</p>}
            {funds && funds.length === 0 && !failed && <p>{t("fund.empty")}</p>}
            {funds && funds.length > 0 && !fund && (
              <ul className="card divide-y px-5 sm:px-6">
                {funds.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => setFund(item)} className="grid w-full gap-x-4 py-3 text-left hover:text-primary sm:grid-cols-[6rem_1fr]">
                      <span className="cipher text-sm font-semibold text-primary">{item.number}</span>
                      <span className="font-medium">{item.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {fund && (
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="cipher font-semibold text-primary">{fund.number}</span>
                <span className="font-medium">{fund.title}</span>
                <button type="button" onClick={() => setFund(null)} className="text-link text-sm">{t("fund.change")}</button>
              </p>
            )}
          </div>
        </Step>
      )}

      {goal && (fund || (funds && funds.length === 0)) && (
        <Step number={3} title={t("result.title")} done>
          <div className="max-w-3xl space-y-5">
            {fund ? (
              <>
                <p>{t("result.found", { number: fund.number })} <Link href={fund.href} className="text-link">{t("result.openFund")}</Link></p>
                {fund.annotation && <Notice tone="warning" title={t("result.noteTitle")}>{fund.annotation}</Notice>}
                {needsCertificate && fund.former_names.length > 1 && (
                  <div className="card p-5">
                    <label htmlFor="navigator-year" className="block font-semibold">{t("result.yearLabel")}</label>
                    <p className="mt-1 text-sm text-muted-foreground">{t("result.yearHint")}</p>
                    <Input id="navigator-year" inputMode="numeric" maxLength={4} value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, ""))} placeholder="1975" className="mt-3 h-11 w-28 text-base" />
                    <p aria-live="polite" className="mt-3">
                      {yearNumber && (nameThen ? <>{t("result.nameThen", { year: yearNumber })} <strong>{nameThen}</strong></> : t("result.nameUnknown", { year: yearNumber }))}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <Notice title={t("result.notFoundTitle")}>
                <p>{t("result.notFound")}</p>
                <p className="mt-2"><Link href="/branches" className="text-link">{t("result.branches")}</Link></p>
              </Notice>
            )}
            <div>
              <h3 className="text-lg">{t("result.nextTitle")}</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                {(["a", "b", "c"] as const).map((key) => <li key={key}>{t(`result.next.${goal}.${key}`)}</li>)}
              </ul>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {needsCertificate ? (
                <>
                  <Button asChild><Link href="/services/state">{t("result.stateService")}</Link></Button>
                  <ExternalLink href="https://egov.kz" className="font-semibold text-primary">{t("result.egov")}</ExternalLink>
                </>
              ) : (
                <>
                  <Button asChild><Link href="/help/reading-room">{t("result.readingRoom")}</Link></Button>
                  <Link href="/catalog" className="text-link font-medium">{t("result.catalog")}</Link>
                </>
              )}
            </div>
          </div>
        </Step>
      )}
    </ol>
  );
}
