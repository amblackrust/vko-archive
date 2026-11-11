import { FileText } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/** Список записей в белой карточке: строки разделены линией и подсвечиваются при наведении. */
export function RecordList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <ul className={cn("card divide-y overflow-hidden", className)}>{children}</ul>;
}

/**
 * Строка записи: шифр и название по одной левой кромке, под ними реквизиты; справа годы, объём или статус.
 * `codeColumn` выносит короткий номер (фонда) в узкую левую колонку — как в архивном справочнике.
 */
export function RecordRow({ code, codeColumn, title, href, lang, meta, aside, thumb, children, heading: Heading = "h3" }: {
  code?: React.ReactNode;
  codeColumn?: boolean;
  /** Миниатюра слева: адрес изображения; null — пустая плашка (строки списка остаются выровненными); не задано — колонки нет. */
  thumb?: string | null;
  title: string;
  href?: string;
  lang?: string;
  /** Строка реквизитов под названием. */
  meta?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
  heading?: "h2" | "h3" | "h4";
}) {
  const column = Boolean(code && codeColumn);
  const codeLine = code ? (
    <p className={cn("cipher flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-primary", column && "sm:pt-0.5")}>{code}</p>
  ) : null;
  return (
    <li className="flex gap-4 px-5 py-4 transition-colors hover:bg-surface-muted sm:px-6">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
        <img src={thumb} alt="" loading="lazy" className="hidden size-20 shrink-0 rounded-md object-cover sm:block" />
      ) : thumb === null ? (
        <span className="hidden size-20 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted-foreground sm:flex" aria-hidden>
          <FileText className="size-6" />
        </span>
      ) : null}
      <div className={cn("grid min-w-0 flex-1 gap-x-6 gap-y-1", column ? "sm:grid-cols-[5rem_1fr_auto]" : "sm:grid-cols-[1fr_auto]")}>
        {column && codeLine}
        <div className="min-w-0">
          {!column && codeLine}
          <Heading className={cn("text-base font-semibold leading-snug [text-wrap:pretty] sm:text-[1.0625rem]", code && !column && "mt-1")} lang={lang}>
            {href ? <Link href={href} className="hover:text-primary hover:underline">{title}</Link> : title}
          </Heading>
          {meta && <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">{meta}</p>}
          {children}
        </div>
        {aside && <div className="flex flex-wrap content-start items-center gap-2 text-sm tabular-nums sm:flex-col sm:items-end sm:text-right">{aside}</div>}
      </div>
    </li>
  );
}
