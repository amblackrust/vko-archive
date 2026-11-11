import { cn } from "@/lib/utils";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

interface PageHeaderProps {
  title: React.ReactNode;
  /** Крошки без «Главной» (она добавляется сама); текущую страницу передавать не нужно. */
  crumbs?: Crumb[];
  /**
   * Подзаголовок — только если он сообщает то, чего нет в названии
   * (срок, условие, куда ведёт действие). Пересказ названия не пишем.
   */
  lead?: React.ReactNode;
  /** Кнопки/ссылки справа от заголовка. */
  actions?: React.ReactNode;
  /** Язык заголовка, если контент пришёл не на языке интерфейса. */
  lang?: string;
  className?: string;
}

/** Шапка внутренней страницы: крошки, крупный заголовок краской, необязательные lead и действия. */
export function PageHeader({ title, crumbs, lead, actions, lang, className }: PageHeaderProps) {
  const currentLabel = typeof title === "string" ? title : undefined;
  return (
    <header className={cn("container-page pb-8 pt-6 sm:pb-10 sm:pt-8", className)}>
      {crumbs !== undefined && (
        <Breadcrumbs items={[...crumbs, ...(currentLabel ? [{ label: currentLabel }] : [])]} bare />
      )}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 sm:mt-10">
        <h1 lang={lang} className="inked max-w-4xl text-4xl sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {lead && <div className="press mt-4 max-w-3xl text-lg text-muted-foreground">{lead}</div>}
    </header>
  );
}
