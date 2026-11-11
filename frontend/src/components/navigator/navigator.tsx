"use client";

import { ArrowRight, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { Input } from "@/components/ui/input";
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

const fundYears = (fund: FundItem) =>
  fund.dates_from && fund.dates_to && fund.dates_from !== fund.dates_to ? `${fund.dates_from}–${fund.dates_to}` : (fund.dates_from ?? fund.dates_to);

/** Шаг навигатора: номер, вопрос и содержимое. Шаг, до которого посетитель ещё не дошёл, показан одним приглушённым заголовком. */
function Step({ number, title, state, children }: { number: number; title: string; state: "done" | "current" | "pending"; children?: React.ReactNode }) {
  const pending = state === "pending";
  return (
    <li aria-current={state === "current" ? "step" : undefined}>
      <h2 className={cn("flex items-center gap-4 text-xl sm:text-2xl", pending && "text-muted-foreground")}>
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-md text-lg font-bold tabular-nums",
            pending ? "bg-surface text-muted-foreground shadow-card" : "bg-primary text-primary-foreground",
          )}
        >
          {number}
        </span>
        {title}
      </h2>
      {children && <div className="mt-5">{children}</div>}
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
  const notFound = funds !== null && funds.length === 0 && !failed;
  const hasResult = goal !== null && (fund !== null || notFound);
  const panel = "card h-full p-6 sm:p-8";

  return (
    <ol className="space-y-10">
      <Step number={1} title={t("goal.title")} state={goal ? "done" : "current"}>
        <fieldset>
          <legend className="sr-only">{t("goal.title")}</legend>
          <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-4">
            {GOALS.map((id) => (
              <label
                key={id}
                className={cn(
                  "card lift relative flex h-full cursor-pointer flex-col gap-1.5 p-5 pr-12 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  goal === id && "bg-primary-soft! shadow-[inset_0_0_0_2px_var(--primary)]!",
                )}
              >
                <input type="radio" name="navigator-goal" value={id} checked={goal === id} onChange={() => setGoal(id)} className="peer sr-only" />
                <span className="text-[1.0625rem] font-semibold leading-snug">{t(`goal.${id}.title`)}</span>
                <span className="text-[0.9375rem] text-muted-foreground">{t(`goal.${id}.text`)}</span>
                <span
                  className="absolute right-4 top-5 grid size-5 place-items-center rounded-full border-2 border-border-strong after:size-2.5 after:rounded-full after:bg-primary after:opacity-0 peer-checked:border-primary peer-checked:after:opacity-100"
                  aria-hidden
                />
              </label>
            ))}
          </div>
        </fieldset>
      </Step>

      <Step number={2} title={t(goal === "family" ? "fund.titleFamily" : "fund.title")} state={!goal ? "pending" : fund ? "done" : "current"}>
        {goal && (
          <div className="card p-5 sm:p-8">
            <label htmlFor="navigator-q" className="block font-medium">{t("fund.label")}</label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="navigator-q"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setFund(null);
                }}
                placeholder={t("fund.placeholder")}
                autoComplete="off"
                aria-describedby="navigator-q-hint"
                className="h-14 pl-12 text-base sm:text-lg"
              />
            </div>
            <p id="navigator-q-hint" className="mt-2 text-[0.9375rem] text-muted-foreground">{t("fund.hint")}</p>
            <div aria-live="polite">
              {failed && <p role="alert" className="mt-5 font-medium">{t("fund.failed")}</p>}
              {notFound && <p className="mt-5 font-medium">{t("fund.empty")}</p>}
              {funds && funds.length > 0 && !fund && (
                <ul className="mt-5 divide-y border-t">
                  {funds.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setFund(item)}
                        className="group grid w-full gap-x-5 gap-y-0.5 py-3.5 text-left sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-baseline"
                      >
                        <span className="cipher text-sm font-semibold text-primary">{item.number}</span>
                        <span className="font-medium [text-wrap:pretty] group-hover:text-primary" lang={item.title_lang}>{item.title}</span>
                        <span className="text-sm tabular-nums text-muted-foreground">{fundYears(item)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {fund && (
                <p className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t pt-4">
                  <span className="cipher text-sm font-semibold text-primary">{fund.number}</span>
                  <span className="min-w-0 flex-1 basis-64 font-medium" lang={fund.title_lang}>{fund.title}</span>
                  <button type="button" onClick={() => setFund(null)} className="text-link font-medium">{t("fund.change")}</button>
                </p>
              )}
            </div>
          </div>
        )}
      </Step>

      <Step number={3} title={t("result.title")} state={hasResult ? "current" : "pending"}>
        {goal && hasResult && (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              {fund ? (
                <section aria-labelledby="navigator-fund" className={cn(panel, "flex flex-col gap-5")}>
                  <div>
                    <p className="text-muted-foreground">{t("result.found", { number: fund.number })}</p>
                    <h3 id="navigator-fund" className="mt-2 text-lg leading-snug sm:text-xl [text-wrap:pretty]" lang={fund.title_lang}>{fund.title}</h3>
                  </div>
                  <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
                    <div className="bg-surface p-4">
                      <dt className="text-sm text-muted-foreground">{t("result.number")}</dt>
                      <dd className="cipher mt-0.5 text-lg font-bold text-primary">{fund.number}</dd>
                    </div>
                    {fundYears(fund) && (
                      <div className="bg-surface p-4">
                        <dt className="text-sm text-muted-foreground">{t("result.years")}</dt>
                        <dd className="mt-0.5 text-lg font-bold tabular-nums">{fundYears(fund)}</dd>
                      </div>
                    )}
                    {fund.units_count != null && (
                      <div className="col-span-2 bg-surface p-4 sm:col-span-1">
                        <dt className="text-sm text-muted-foreground">{t("result.units")}</dt>
                        <dd className="mt-0.5 text-lg font-bold tabular-nums">{fund.units_count.toLocaleString("ru-RU")}</dd>
                      </div>
                    )}
                  </dl>
                  {fund.annotation && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t("result.noteTitle")}</p>
                      <p className="mt-1" lang={fund.title_lang}>{fund.annotation}</p>
                    </div>
                  )}
                  {needsCertificate && fund.former_names.length > 1 && (
                    <div className="rounded-md bg-surface-muted p-5">
                      <label htmlFor="navigator-year" className="block font-semibold">{t("result.yearLabel")}</label>
                      <p id="navigator-year-hint" className="mt-1 text-[0.9375rem] text-muted-foreground">{t("result.yearHint")}</p>
                      <Input
                        id="navigator-year"
                        inputMode="numeric"
                        maxLength={4}
                        value={year}
                        onChange={(event) => setYear(event.target.value.replace(/\D/g, ""))}
                        placeholder="1975"
                        aria-describedby="navigator-year-hint"
                        className="mt-3 h-12 w-28 text-lg tabular-nums"
                      />
                      <p aria-live="polite" className="mt-3 empty:hidden">
                        {yearNumber && (nameThen ? <>{t("result.nameThen", { year: yearNumber })} <strong lang={fund.title_lang}>{nameThen}</strong></> : t("result.nameUnknown", { year: yearNumber }))}
                      </p>
                    </div>
                  )}
                  <p className="mt-auto">
                    <Button asChild variant="outline"><Link href={fund.href}>{t("result.openFund")} <ArrowRight aria-hidden /></Link></Button>
                  </p>
                </section>
              ) : (
                <section aria-labelledby="navigator-missing" className={cn(panel, "flex flex-col gap-4")}>
                  <h3 id="navigator-missing" className="text-xl leading-snug">{t("result.notFoundTitle")}</h3>
                  <p>{t("result.notFound")}</p>
                  <p className="mt-auto">
                    <Button asChild variant="outline"><Link href="/branches">{t("result.branches")} <ArrowRight aria-hidden /></Link></Button>
                  </p>
                </section>
              )}
            </div>

            <section aria-labelledby="navigator-next" className={cn(panel, "flex flex-col gap-5 lg:col-span-5")}>
              <h3 id="navigator-next" className="text-xl">{t("result.nextTitle")}</h3>
              <ol className="space-y-4">
                {(["a", "b", "c"] as const).map((key, index) => (
                  <li key={key} className="flex gap-4">
                    <span className="w-4 shrink-0 text-lg font-bold leading-snug tabular-nums text-primary" aria-hidden>{index + 1}</span>
                    <span>{t(`result.next.${goal}.${key}`)}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-5">
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
            </section>
          </div>
        )}
      </Step>
    </ol>
  );
}
