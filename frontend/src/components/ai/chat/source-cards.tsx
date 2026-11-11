"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ExternalLink } from "@/components/ui/external-link";
import { Link } from "@/lib/i18n/navigation";
import type { AiResult, AiSource } from "@/lib/api/ai";

const HINTS = ["remove_doc_type", "remove_period", "rephrase", "browse_catalog", "ask_site_sections"];
const VISIBLE = 3;

/** Источник ответа — карточка записи: номер (на него ссылается текст), вид и шифр, название-ссылка, доступ, контакты, маршруты. */
function Source({ source }: { source: AiSource }) {
  const t = useTranslations("ai");
  const tc = useTranslations("catalog");
  const details = [source.address, source.phone, source.hours].filter(Boolean);
  return (
    <li className="group relative rounded-xl border bg-surface p-3.5 text-sm transition-colors hover:border-primary">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-primary">
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[0.6875rem] tabular-nums text-primary-foreground">{source.ref.slice(1)}</span>
        {t(`sourceType.${source.type}`)}
        {source.archive_code && <span className="cipher text-muted-foreground">{source.archive_code}</span>}
        {source.date_text && <span className="font-normal text-muted-foreground">{source.date_text}</span>}
      </p>
      <p className="mt-1.5 pr-6 font-semibold leading-snug">
        {source.href ? (
          <Link href={source.href} className="line-clamp-2 after:absolute after:inset-0 group-hover:text-primary">{source.title}</Link>
        ) : (
          <span className="line-clamp-2">{source.title}</span>
        )}
      </p>
      {source.href && <ArrowUpRight className="absolute right-3 top-3 size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />}
      {source.access && source.access !== "open" && (
        <p className="mt-1.5"><span className="font-semibold">{tc(`access.${source.access}`)}.</span> {source.access_conditions}</p>
      )}
      {details.length > 0 && <div className="mt-1.5 space-y-0.5 text-muted-foreground">{details.map((line) => <p key={line}>{line}</p>)}</div>}
      {source.routes.length > 0 && (
        <p className="relative mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {source.routes.map((route) => (
            <ExternalLink key={route.provider} href={route.url} className="font-semibold text-primary">
              {t("route", { provider: t(`provider.${route.provider}`) })}
            </ExternalLink>
          ))}
        </p>
      )}
    </li>
  );
}

/** Источники, внешние ссылки (eGov, e-Otinish) и подсказки к ответу; всё строит сервер, а не модель. */
export function AnswerExtras({ result }: { result: AiResult }) {
  const t = useTranslations("ai");
  const [all, setAll] = useState(false);
  const hints = result.hints.filter((hint) => HINTS.includes(hint));
  const sources = all ? result.sources : result.sources.slice(0, VISIBLE);
  const hidden = result.sources.length - VISIBLE;
  return (
    <>
      {result.sources.length > 0 && (
        <section aria-label={t("sources")} className="mt-4">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("sources")}</h3>
          <ol className="mt-2 space-y-2">{sources.map((source) => <Source key={source.ref} source={source} />)}</ol>
          {hidden > 0 && (
            <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="mt-2 text-sm font-semibold text-primary hover:underline">
              {all ? t("sourcesLess") : t("sourcesMore", { count: hidden })}
            </button>
          )}
        </section>
      )}
      {result.links.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          {result.links.map((link) => (
            <ExternalLink key={link.id} href={link.url} className="rounded-full bg-primary-soft px-3.5 py-1.5 font-semibold text-primary">{t(`external.${link.id}`)}</ExternalLink>
          ))}
        </p>
      )}
      {hints.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {hints.map((hint) => <li key={hint}>{t(`hints.${hint}`)}</li>)}
        </ul>
      )}
    </>
  );
}
