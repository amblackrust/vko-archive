import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { DocumentItem } from "@/lib/api/catalog";
import { fileUrl } from "@/lib/api/document";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const LEVELS = [
  { id: "funds", href: "/catalog/funds" },
  { id: "inventories", href: "/catalog/inventories" },
  { id: "cases", href: "/catalog/cases" },
  { id: "documents", href: "/catalog" },
] as const;

/** Три документа для витрины: карта, фотография и рисунок — разные по виду, только подлинные и с изображением. */
export function pickFeatured(items: DocumentItem[]): DocumentItem[] {
  const real = items.filter((item) => item.preview_url && !item.is_demo);
  const of = (type: string) => real.filter((item) => item.doc_type === type);
  const picked = [of("map")[0], of("photo")[0], of("drawing")[0]].filter(Boolean);
  for (const item of real) if (picked.length < 3 && !picked.includes(item)) picked.push(item);
  return picked.slice(0, 3);
}

/** Документ на витрине: изображение во всю плитку, поверх — шифр и название. */
function Tile({ item, large }: { item: DocumentItem; large?: boolean }) {
  return (
    <li className={cn("relative overflow-hidden rounded-2xl bg-surface-muted", large ? "col-span-2 aspect-[4/3] sm:col-span-3 sm:row-span-2 sm:aspect-auto" : "aspect-square sm:col-span-2 sm:aspect-auto")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав */}
      <img src={fileUrl(item.preview_url!)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover/tile:scale-105" />
      <Link href={item.href} className="group/tile absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#152040]/90 via-[#152040]/25 to-transparent p-3 text-white sm:p-4">
        <span className="cipher text-xs font-semibold text-white/80">{item.archive_code}</span>
        <span className={cn("mt-0.5 line-clamp-2 font-semibold leading-snug group-hover/tile:underline", large ? "text-lg" : "text-[0.9375rem]")}>{item.title}</span>
      </Link>
    </li>
  );
}

/**
 * Каталог на главной: слева — как он устроен (фонды, описи, дела, документы — равными плитками со счётчиками),
 * справа — настоящие документы с изображениями, ниже — категории ровными плитками.
 */
export function CatalogShowcase({ counts, categories, featured }: {
  counts: Record<(typeof LEVELS)[number]["id"], number | null>;
  categories: { value: string; label: string; count: number }[];
  featured: DocumentItem[];
}) {
  const t = useTranslations("home.catalog");
  return (
    <section aria-labelledby="home-catalog" className="container-page py-10 lg:py-14">
      <div className="card overflow-hidden rounded-3xl">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:gap-10 lg:p-10">
          <div className="flex flex-col lg:col-span-5">
            <h2 id="home-catalog" className="text-2xl sm:text-3xl">{t("title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("text")}</p>

            <h3 className="mt-7 text-sm font-semibold text-muted-foreground">{t("structure")}</h3>
            <ol className="mt-3 grid auto-rows-fr grid-cols-2 gap-3">
              {LEVELS.map(({ id, href }) => (
                <li key={id}>
                  <Link href={href} className="group flex h-full flex-col rounded-xl bg-surface-muted p-4 transition-colors hover:bg-primary-soft">
                    <span className="text-2xl font-bold tabular-nums text-primary">{counts[id]?.toLocaleString("ru-RU") ?? "—"}</span>
                    <span className="mt-1 font-semibold group-hover:text-primary">{t(`levels.${id}.name`)}</span>
                    <span className="mt-0.5 text-sm text-muted-foreground">{t(`levels.${id}.hint`)}</span>
                  </Link>
                </li>
              ))}
            </ol>

            <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-7">
              <Button asChild size="lg">
                <Link href="/catalog">{t("open")} <ArrowRight aria-hidden /></Link>
              </Button>
              <Link href="/help#search" className="text-link font-semibold">{t("howto")}</Link>
            </div>
          </div>

          {featured.length > 0 && (
            <ul aria-label={t("featured")} className="grid grid-cols-2 gap-3 sm:h-[30rem] sm:grid-cols-5 sm:grid-rows-2 lg:col-span-7 lg:h-auto lg:min-h-[30rem]">
              {featured.map((item, index) => <Tile key={item.id} item={item} large={index === 0} />)}
            </ul>
          )}
        </div>

        <div className="border-t bg-surface-muted/50 p-6 sm:p-8 lg:px-10">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("categories")}</h3>
          <ul className="mt-3 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map(({ value, label, count }) => (
              <li key={value}>
                <Link href={`/catalog?category=${value}`} className="group flex h-full min-h-16 items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 shadow-card transition-colors hover:text-primary">
                  <span className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug">{label}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/catalog" className="flex h-full min-h-16 items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground transition-colors hover:bg-primary-hover">
                <span className="text-[0.9375rem] font-semibold">{t("all")}</span>
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
