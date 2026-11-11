import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchPublic, type ExhibitionList } from "@/components/exhibitions/api";
import { ExhibitionCard } from "@/components/exhibitions/exhibition-card";
import { FilterForm, filterValues } from "@/components/memory/filter-form";
import { themeLabel } from "@/components/memory/labels";
import { DemoBadge } from "@/components/ui/demo-badge";
import { DemoTag } from "@/components/ui/demo-tag";
import { PageHeader } from "@/components/ui/page-header";
import { RecordList, RecordRow } from "@/components/ui/record-list";
import { Section } from "@/components/ui/section";
import { UnavailableState } from "@/components/ui/state-view";
import { attempt, fetchCollections, fetchMapPoints, fetchPersons, fetchTimeline } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";
import { localizedAlternates } from "@/lib/seo";

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

  const ways = [
    { id: "collections", unit: "collections", href: "/memory#collections", count: all.items.length },
    { id: "people", unit: "people", href: "/memory#persons", count: persons?.length },
    { id: "timeline", unit: "events", href: "/memory/timeline", count: timeline?.items.length },
    { id: "map", unit: "places", href: "/memory/map", count: places?.items.length },
    { id: "exhibitions", unit: "exhibitions", href: "/exhibitions", count: exhibitions?.total },
  ];
  const amount = (unit: string, count: number) => `${count} ${t(`units.${unit}`, { count })}`;

  /** Куда ведёт направление и чем оно наполнено: коллекциями своей темы, а без них — личностями или хронологией; null — материалы готовятся. */
  function directionEntry(theme: string) {
    const count = all!.themes.find((facet) => facet.value === theme)?.count;
    if (count) return { href: `/memory?theme=${theme}#collections`, status: amount("collections", count) };
    if (theme === "people" && persons?.length) return { href: "/memory#persons", status: amount("people", persons.length) };
    if (theme === "periods" && timeline?.items.length) return { href: "/memory/timeline", status: amount("events", timeline.items.length) };
    return null;
  }

  return (
    <>
      <PageHeader tone="brand" crumbs={[{ label: t("breadcrumb") }]} title={t("title")} lead={t("intro")} />
      <nav aria-label={t("ways.label")} className="container-page">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ways.map((way) => (
            <li key={way.id}>
              <Link href={way.href} className="card lift group flex h-full flex-col gap-1 p-5">
                {way.count != null && (
                  <span className="text-sm text-muted-foreground">
                    <span className="mr-1.5 text-3xl font-bold tabular-nums text-primary">{way.count}</span>
                    {t(`units.${way.unit}`, { count: way.count })}
                  </span>
                )}
                <span className="text-[1.0625rem] font-semibold group-hover:text-primary">{t(`ways.${way.id}.title`)}</span>
                <span className="text-sm text-muted-foreground">{t(`ways.${way.id}.text`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="directions" title={t("directions.title")} text={t("directions.text")}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DIRECTIONS.map((direction) => {
            const entry = directionEntry(direction);
            const name = t(`directions.${direction}`);
            return (
              <li key={direction}>
                {entry ? (
                  <Link href={entry.href} className="card lift group flex h-full items-start justify-between gap-3 p-4">
                    <span className="font-semibold group-hover:text-primary">{name}</span>
                    <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-0.5 text-sm font-medium text-primary">{entry.status}</span>
                  </Link>
                ) : (
                  // Направление без материалов — не ссылка: пунктирная рамка и подпись «готовятся».
                  <div className="flex h-full flex-col gap-1 rounded-lg border border-dashed border-border-strong p-4 text-muted-foreground">
                    <span>{name}</span>
                    <span className="text-sm">{t("directions.pending")}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="collections" title={t("collections.title")} text={t("collections.text")}>
        <FilterForm
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
            <p className="text-lg font-semibold">{t(filtered ? "collections.noneFound" : "collections.empty")}</p>
            <p className="text-muted-foreground">{t(filtered ? "collections.noneFoundText" : "collections.emptyText")}</p>
            <p>
              <Link href={filtered ? "/memory#collections" : "/catalog"} className="text-link font-medium">{t(filtered ? "collections.showAll" : "collections.toCatalog")}</Link>
            </p>
          </div>
        ) : (
          <RecordList className="mt-4">
            {collections.map((item) => (
              <RecordRow
                key={item.slug}
                title={item.title}
                href={item.href}
                lang={item.title_lang}
                meta={
                  <>
                    {item.theme && <span>{themeLabel(t, "themes", item.theme)}</span>}
                    {item.period && <span>{item.period}</span>}
                    {item.is_demo && <DemoTag />}
                    {item.translation_missing && <DemoBadge kind="noTranslation" />}
                  </>
                }
                aside={<span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-muted-foreground">{t("collections.items", { count: item.item_count })}</span>}
              >
                {item.description && <p className="mt-2 line-clamp-2 max-w-3xl text-sm" lang={item.title_lang}>{item.description}</p>}
              </RecordRow>
            ))}
          </RecordList>
        )}
      </Section>

      <Section id="persons" title={t("people.title")} text={t("people.text")}>
        {people.length === 0 ? (
          <p className="card max-w-2xl p-6 text-muted-foreground">{filters.q ? t("people.noneFound", { q: filters.q }) : t("people.empty")}</p>
        ) : (
          <RecordList>
            {people.map((person) => (
              <RecordRow
                key={person.slug}
                title={person.name}
                href={person.href}
                lang={person.name_lang}
                meta={(person.is_demo || person.translation_missing) && (
                  <>
                    {person.is_demo && <DemoTag />}
                    {person.translation_missing && <DemoBadge kind="noTranslation" />}
                  </>
                )}
                aside={person.years_text}
              >
                {person.bio && <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-muted-foreground" lang={person.name_lang}>{person.bio}</p>}
              </RecordRow>
            ))}
          </RecordList>
        )}
      </Section>

      {exhibitions && exhibitions.items.length > 0 && (
        <Section id="memory-exhibitions" title={t("exhibitions.title")} text={t("exhibitions.text")} href="/exhibitions" linkLabel={t("exhibitions.all")}>
          <ul className="grid gap-4 md:grid-cols-3">
            {exhibitions.items.slice(0, 3).map((item) => (
              <li key={item.id}><ExhibitionCard exhibition={item} locale={locale} heading="h3" /></li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
