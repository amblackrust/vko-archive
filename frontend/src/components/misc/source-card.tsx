import { ArrowUpRight, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { govServices, type GovService } from "@/components/ui/brand";
import { cn } from "@/lib/utils";

/**
 * Карточка внешнего источника с собственным названием: нормативный акт на «Әділет», страница на сайте Президента,
 * ссылка, добавленная архивом. `portal` даёт знак и адрес государственного портала; без него — нейтральный знак и домен из ссылки.
 */
export function SourceCard({ href, title, portal }: { href: string; title: string; portal?: GovService }) {
  const t = useTranslations("common");
  const service = portal ? govServices[portal] : null;
  let domain: string | undefined = service?.domain;
  if (!domain) {
    try {
      domain = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      domain = undefined;
    }
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="card lift group flex h-full items-start gap-4 p-5">
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl text-sm font-bold tracking-tight text-white [&_svg]:size-5", service ? service.tile : "bg-foreground text-background")} aria-hidden>
        {service ? service.mark : <Globe />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug group-hover:text-primary">{title}</span>
        {domain && <span className="mt-1 block truncate text-sm text-muted-foreground">{domain}</span>}
      </span>
      <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
      <span className="sr-only">({t("external")})</span>
    </a>
  );
}
