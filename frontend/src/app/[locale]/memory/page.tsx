import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchPublic, type ExhibitionList } from "@/components/exhibitions/api";
import { ExhibitionCard } from "@/components/exhibitions/exhibition-card";
import { CollectionCard } from "@/components/memory/collection-card";
import { FilterForm, filterValues } from "@/components/memory/filter-form";
import { evenGrid, TILE_COLS } from "@/components/memory/grid";
import { themeLabel } from "@/components/memory/labels";
import { PersonCard } from "@/components/memory/person-card";
import { LinkTile } from "@/components/ui/link-tile";
import { PageHeader } from "@/components/ui/page-header";
import { UnavailableState } from "@/components/ui/state-view";
import { attempt, fetchCollection, fetchCollections, fetchMapPoints, fetchPerson, fetchPersons, fetchTimeline } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

/**
 * Одиннадцать направлений раздела из ТЗ (§5.6) в порядке ТЗ. Ключ направления — это тема коллекций (поле theme в API),
 * которой оно наполняется; отдельного поля «направление» у коллекции нет.
 */
const DIRECTIONS = ["region", "ust-kamenogorsk", "industry", "people", "education", "culture", "military", "war", "family", "organisations", "periods"];

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "memory" });
  return { title: t("title"), description: t("intro"), alternates: localizedAlternates(locale, "/memory") };
}

const h2 = "text-2xl sm:text-3xl";
/** Выставки: столько колонок, сколько карточек (до четырёх), чтобы ряд был полным. */
const SHOW_COLS = ["", "", "sm:grid-cols-2", "sm:grid-cols-2 lg:grid-cols-3", "sm:grid-cols-2 lg:grid-cols-4"];

/** Входная страница раздела — витрина: коллекции с обложками, личности с портретами, выставки, указатель направлений. */
export default async function MemoryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("memory");
  const filters = filterValues(await searchParams);
  const filtered = Boolean(filters.q || filters.theme || filters.period);
  // Счётчики и указатель направлений строятся по всему разделу, список — по условиям поиска.
  const [all, found, persons, foundPersons, timeline, places, exhibitions] = await Promise.all([
    attempt(fetchCollections(locale)),
    filtered ? attempt(fetchCollections(locale, filters)) : undefined,
    attempt(fetchPersons(locale)),
    filters.q ? attempt(fetchPersons(locale, filters.q)) : undefined,
    attempt(fetchTimeline(locale)),
    attempt(fetchMapPoints(locale)),
    attempt(fetchPublic<ExhibitionList>("exhibitions", new URLSearchParams(), locale)),
  ]);
  if (!all) return <UnavailableState />;
  const collections = (filtered ? found?.items : all.items) ?? [];
  const people = (filters.q ? foundPersons : persons) ?? [];
  // В списках API нет изображений: обложка коллекции — первый её документ с открытой копией, портрет — первая фотография личности.
  const [details, portraits] = await Promise.all([
    Promise.all(collections.map((item) => attempt(fetchCollection(item.slug, locale)))),
    Promise.all(people.map(async (item) => (await attempt(fetchPerson(item.slug, locale)))?.documents.find((doc) => doc.doc_type === "photo" && doc.preview_url)?.preview_url)),
  ]);
  // Один документ бывает в нескольких коллекциях: соседним плиткам достаются разные изображения.
  const used = new Set<string>();
  const covers = details.map((detail) => {
    const previews = detail?.documents.flatMap((doc) => (doc.preview_url ? [doc.preview_url] : [])) ?? [];
    const cover = previews.find((preview) => !used.has(preview)) ?? previews[0];
    if (cover) used.add(cover);
    return cover;
  });

  const amount = (unit: string, count: number) => `${count} ${t(`units.${unit}`, { count })}`;
  const ways = [
    { id: "timeline", href: "/memory/timeline", count: timeline?.items.length },
    { id: "map", href: "/memory/map", count: places?.items.length },
    { id: "exhibitions", href: "/exhibitions", count: exhibitions?.total },
  ];

  /** Куда ведёт направление и чем оно наполнено: коллекциями своей темы, а без них — личностями или хронологией. */
  function directionEntry(theme: string) {
    const count = all!.themes.find((facet) => facet.value === theme)?.count;
    if (count) return { href: `/memory?theme=${theme}#collections`, status: amount("collections", count) };
    if (theme === "people" && persons?.length) return { href: "/memory#persons", status: amount("people", persons.length) };
    if (theme === "periods" && timeline?.items.length) return { href: "/memory/timeline", status: amount("events", timeline.items.length) };
    return null;
  }
  // Темы без материалов не показываются: появятся вместе с первой коллекцией.
  const directions = DIRECTIONS.flatMap((id) => {
    const entry = directionEntry(id);
    return entry ? [{ id, ...entry }] : [];
  });
  // Результаты поиска остаются плитками обычного размера; полный список подбирает число колонок под полный ряд.
  const collectionGrid = filtered ? { cols: 4, closing: false } : evenGrid(collections.length);
  const shows = exhibitions?.items.slice(0, 4) ?? [];

  return (
    <>
      <PageHeader tone="brand" crumbs={[{ label: t("breadcrumb") }]} title={t("title")} lead={t("intro")} />
      <div className="container-page space-y-14 pb-16 pt-2">
        <nav aria-label={t("ways.label")}>
          <ul className="grid auto-rows-fr gap-4 md:grid-cols-3">
            {ways.map((way) => (
              <li key={way.id}>
                <LinkTile href={way.href} title={t(`ways.${way.id}.title`)} text={way.count ? t(`ways.${way.id}.count`, { count: way.count }) : t(`ways.${way.id}.text`)} />
              </li>
            ))}
          </ul>
        </nav>

        {(collections.length > 0 || filtered) && (
          <section aria-labelledby="collections">
            <h2 id="collections" className={cn(h2, "scroll-mt-28")}>{t("collections.title")}</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">{t("collections.text")}</p>
            <FilterForm
              className="mt-6"
              path="/memory#collections"
              label={t("filters.label")}
              values={filters}
              themes={all.themes.map((facet) => ({ value: facet.value, label: `${themeLabel(t, "themes", facet.value)} (${facet.count})` }))}
              periods={all.periods.map((facet) => ({ value: facet.value, label: `${facet.value} (${facet.count})` }))}
              text={{ q: t("filters.q"), theme: t("filters.theme"), period: t("filters.period"), all: t("filters.all"), submit: t("filters.submit"), reset: t("filters.reset") }}
            />
            {filtered && <p role="status" className="mt-6 font-semibold">{t("collections.found", { count: collections.length })}</p>}
            {collections.length === 0 ? (
              <div className="card mt-4 space-y-2 p-6">
                <p className="text-lg font-semibold">{t("collections.noneFound")}</p>
                <p className="text-muted-foreground">{t("collections.noneFoundText")}</p>
                <p><Link href="/memory#collections" className="text-link font-medium">{t("collections.showAll")}</Link></p>
              </div>
            ) : (
              <ul className={cn("grid auto-rows-fr gap-3 sm:gap-5", filtered ? "mt-4" : "mt-6", TILE_COLS[collectionGrid.cols])}>
                {collections.map((item, index) => (
                  <li key={item.slug} className="min-w-0"><CollectionCard collection={item} cover={covers[index]} /></li>
                ))}
                {collectionGrid.closing && (
                  <li><LinkTile accent href="/catalog" title={t("collections.toCatalog")} text={t("collections.toCatalogText")} /></li>
                )}
              </ul>
            )}
          </section>
        )}

        {(people.length > 0 || filters.q) && (
          <section aria-labelledby="persons">
            <h2 id="persons" className={cn(h2, "scroll-mt-28")}>{t("people.title")}</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">{t("people.text")}</p>
            {people.length === 0 ? (
              <p className="card mt-6 max-w-2xl p-6 text-muted-foreground">{t("people.noneFound", { q: filters.q })}</p>
            ) : (
              <ul className="mt-6 grid auto-rows-fr gap-4 lg:grid-cols-2">
                {people.map((person, index) => (
                  <li key={person.slug} className="min-w-0"><PersonCard person={person} portrait={portraits[index]} /></li>
                ))}
                {people.length % 2 === 1 && (
                  <li><LinkTile href="/memory/timeline?theme=people" title={t("people.inTimeline")} text={t("people.inTimelineText")} /></li>
                )}
              </ul>
            )}
          </section>
        )}

        {shows.length > 0 && (
          <section aria-labelledby="memory-exhibitions">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <div>
                <h2 id="memory-exhibitions" className={h2}>{t("exhibitions.title")}</h2>
                <p className="mt-2 max-w-3xl text-muted-foreground">{t("exhibitions.text")}</p>
              </div>
              <Link href="/exhibitions" className="text-link font-semibold">{t("exhibitions.all")}</Link>
            </div>
            <ul className={cn("mt-6 grid auto-rows-fr gap-5", SHOW_COLS[shows.length])}>
              {shows.map((item) => (
                <li key={item.id} className="min-w-0"><ExhibitionCard exhibition={item} heading="h3" /></li>
              ))}
            </ul>
          </section>
        )}

        {directions.length > 0 && (
          <section aria-labelledby="directions" className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 id="directions" className={h2}>{t("directions.title")}</h2>
              <p className="mt-3 text-muted-foreground">{t("directions.text")}</p>
            </div>
            <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:col-span-8">
              {directions.map((direction) => (
                <li key={direction.id}>
                  <Link href={direction.href} className="card lift group flex h-full items-center gap-4 p-5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug group-hover:text-primary">{t(`directions.${direction.id}`)}</span>
                      <span className="mt-1 block text-sm tabular-nums text-muted-foreground">{direction.status}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
                  </Link>
                </li>
              ))}
              {directions.length % 2 === 1 && (
                <li><LinkTile accent href="/catalog" title={t("collections.toCatalog")} text={t("collections.toCatalogText")} /></li>
              )}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
