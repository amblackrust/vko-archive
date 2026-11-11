import { cn } from "@/lib/utils";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

/**
 * Шапка страницы: хлебные крошки, заголовок, вводный абзац, строка пометок и действий.
 * `tone="brand"` — градиентный баннер-карточка для входных страниц разделов; `aside` — колонка справа (обложка, цифры).
 */
export function PageHeader({ crumbs, title, titleLang, lead, meta, actions, aside, tone = "plain", children }: {
  crumbs: Crumb[];
  title: string;
  titleLang?: string;
  lead?: React.ReactNode;
  /** Пометки над заголовком: шифр, статус доступа, тип. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  tone?: "plain" | "brand";
  children?: React.ReactNode;
}) {
  const brand = tone === "brand";
  // Полные официальные наименования (фонды, учреждения) занимают до шести строк — им нужен кегль меньше.
  const long = title.length > 90;
  return (
    <header>
      <Breadcrumbs items={crumbs} />
      <div className="container-page pb-6">
        <div className={cn("grid gap-8", aside && "lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center", brand ? "on-brand rounded-3xl p-6 sm:p-10 lg:p-12" : "pt-1")}>
          <div className="min-w-0 space-y-4">
            {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
            <h1 className={cn("max-w-4xl break-words", long ? "text-2xl sm:text-[1.75rem]" : "text-3xl sm:text-4xl", brand && !long && "lg:text-5xl")} lang={titleLang}>{title}</h1>
            {lead && <div className="max-w-3xl text-lg text-muted-foreground">{lead}</div>}
            {actions && <div className="flex flex-wrap items-center gap-3 pt-1" data-noprint>{actions}</div>}
            {children}
          </div>
          {aside}
        </div>
      </div>
    </header>
  );
}
