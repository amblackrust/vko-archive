import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import type { AiResult, AiSource } from "@/lib/api/ai";

const HINTS = ["remove_doc_type", "remove_period", "rephrase", "browse_catalog", "ask_site_sections"];

function SourceCard({ source }: { source: AiSource }) {
  const t = useTranslations("ai");
  const tc = useTranslations("catalog");
  const meta = [source.date_text, source.archive_code].filter(Boolean).join(" · ");
  const contacts = [source.address, source.phone, source.hours].filter(Boolean);
  return (
    <li className="rounded-md border bg-surface p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold">{source.ref.slice(1)}</span> · {t(`sourceType.${source.type}`)}
      </p>
      {source.href ? (
        <Link href={source.href} className="font-medium text-primary hover:underline">{source.title}</Link>
      ) : (
        <p className="font-medium">{source.title}</p>
      )}
      {meta && <p className="mt-0.5 break-all text-muted-foreground">{meta}</p>}
      {source.access && source.access !== "open" && (
        <p className="mt-1">
          <span className="font-medium">{tc(`access.${source.access}`)}.</span>{" "}
          {source.access_conditions}
        </p>
      )}
      {contacts.map((line) => (
        <p key={line} className="mt-0.5">{line}</p>
      ))}
      {source.routes.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {source.routes.map((route) => (
            <a
              key={route.provider}
              href={route.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t("route", { provider: t(`provider.${route.provider}`) })}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          ))}
        </p>
      )}
    </li>
  );
}

/** Карточки-источники, внешние ссылки (eGov, e-Otinish) и подсказки к ответу; всё строит сервер. */
export function AnswerExtras({ result }: { result: AiResult }) {
  const t = useTranslations("ai");
  const hints = result.hints.filter((hint) => HINTS.includes(hint));
  return (
    <>
      {result.sources.length > 0 && (
        <section aria-label={t("sources")} className="mt-3">
          <h3 className="mb-2 text-sm font-semibold">{t("sources")}</h3>
          <ul className="grid gap-2">
            {result.sources.map((source) => (
              <SourceCard key={source.ref} source={source} />
            ))}
          </ul>
        </section>
      )}
      {result.links.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {result.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {t(`external.${link.id}`)}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ))}
        </p>
      )}
      {hints.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {hints.map((hint) => (
            <li key={hint}>{t(`hints.${hint}`)}</li>
          ))}
        </ul>
      )}
    </>
  );
}
