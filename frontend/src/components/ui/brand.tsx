import { ArrowUpRight, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Знаки соцсетей и карточки внешних ресурсов. Знаки нарисованы здесь же (в lucide брендовых иконок нет):
 * цветная плашка сети и белый глиф. Для государственных порталов — плашка с названием, без копирования их логотипов.
 */
const networks = {
  instagram: {
    tile: "bg-[radial-gradient(circle_at_30%_107%,#fdf497_0%,#fd5949_45%,#d6249f_60%,#285aeb_90%)]",
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="3.8" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  facebook: {
    tile: "bg-[#1877f2]",
    glyph: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M13.6 21v-7.6h2.5l.4-3h-2.9V8.5c0-.9.3-1.5 1.6-1.5h1.5V4.3c-.3 0-1.200-.1-2.200-.1-2.200 0-3.700 1.300-3.700 3.800v2.400H8.300v3h2.500V21h2.800Z" />
      </svg>
    ),
  },
  telegram: {
    tile: "bg-[#26a5e4]",
    glyph: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20.300 4.300 3.600 10.700c-.800.300-.800 1.100-.100 1.300l4.200 1.300 1.600 5c.200.600.900.700 1.300.300l2.400-2.300 4.300 3.200c.500.300 1.100.100 1.300-.500l3-13.600c.200-.800-.500-1.400-1.300-1.100Zm-3.200 3.500-6.700 6.100-.300 3-1.300-4.100 8.300-5Z" />
      </svg>
    ),
  },
  youtube: {
    tile: "bg-[#ff0000]",
    glyph: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M10 8.500v7l6-3.500-6-3.500Z" />
      </svg>
    ),
  },
  whatsapp: {
    tile: "bg-[#25d366]",
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
        <path d="M4 20l1.200-4.200A8 8 0 1 1 8.300 19L4 20Z" />
      </svg>
    ),
  },
} as const;

export type Network = keyof typeof networks;

/** Знак соцсети: цветная скруглённая плашка с белым глифом. Незнакомая сеть — нейтральная плашка с глобусом. */
export function SocialLogo({ network, className }: { network: string; className?: string }) {
  const known = networks[network as Network];
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-white [&_svg]:size-[55%]", known ? known.tile : "bg-foreground", className)}>
      {known ? known.glyph : <Globe aria-hidden />}
    </span>
  );
}

/** Карточка соцсети: знак, название сети и имя страницы; открывается в новой вкладке. */
export function SocialCard({ network, name, handle, href }: { network: string; name: string; handle?: string | null; href: string }) {
  const t = useTranslations("common");
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="card lift group flex h-full items-center gap-4 p-4">
      <SocialLogo network={network} className="size-12" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold group-hover:text-primary">{name}</span>
        {handle && <span className="block truncate text-sm text-muted-foreground">{handle}</span>}
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
      <span className="sr-only">({t("external")})</span>
    </a>
  );
}

/** Государственные порталы: адрес, короткая подпись на плашке и её цвет. Названия и описания — common.services.<id>. */
export const govServices = {
  egov: { href: "https://egov.kz", domain: "egov.kz", mark: "eGov", tile: "bg-[#0b8f5a]" },
  eotinish: { href: "https://eotinish.kz", domain: "eotinish.kz", mark: "eO", tile: "bg-[#1565c0]" },
  adilet: { href: "https://adilet.zan.kz", domain: "adilet.zan.kz", mark: "Ә", tile: "bg-[#8a5a00]" },
  govkz: { href: "https://www.gov.kz", domain: "gov.kz", mark: "gov", tile: "bg-[#0c5bb5]" },
  akorda: { href: "https://www.akorda.kz", domain: "akorda.kz", mark: "A", tile: "bg-[#0e7c9b]" },
  akimat: { href: "https://www.gov.kz/memleket/entities/akimvko", domain: "gov.kz", mark: "ВКО", tile: "bg-[#3247d3]" },
} as const;

export type GovService = keyof typeof govServices;

/**
 * Карточка государственного портала: плашка с названием, имя, адрес и для чего он нужен.
 * `href` заменяет адрес по умолчанию (например, ссылка на конкретный акт на «Әділет»); `compact` — без описания.
 */
export function GovServiceCard({ id, href, compact }: { id: GovService; href?: string; compact?: boolean }) {
  const t = useTranslations("common");
  const service = govServices[id];
  return (
    <a href={href ?? service.href} target="_blank" rel="noopener noreferrer" className="card lift group flex h-full items-start gap-4 p-5">
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl text-sm font-bold tracking-tight text-white", service.tile)} aria-hidden>{service.mark}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="font-semibold group-hover:text-primary">{t(`services.${id}.name`)}</span>
          <span className="truncate text-sm text-muted-foreground">{service.domain}</span>
        </span>
        {!compact && <span className="mt-1 block text-[0.9375rem] text-muted-foreground">{t(`services.${id}.text`)}</span>}
      </span>
      <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
      <span className="sr-only">({t("external")})</span>
    </a>
  );
}
