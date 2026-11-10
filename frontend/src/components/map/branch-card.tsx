import { Mail, MapPin, Phone, Clock, UserRound, Archive } from "lucide-react";
import { useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import type { Branch } from "@/lib/api/branches";
import { RoutePanel } from "./route-panel";

/** Карточка филиала со всеми полями ТЗ §5.5. Пустые поля — «уточняется», а не пропуск. */
export function BranchCard({ branch, locale, headingLevel = 2, showDetailsLink = false }: {
  branch: Branch;
  locale: string;
  headingLevel?: 1 | 2 | 3;
  showDetailsLink?: boolean;
}) {
  const t = useTranslations("map");
  const Heading = `h${headingLevel}` as const;
  const pending = <span className="text-muted-foreground">{t("card.pending")}</span>;
  const rows = [
    { icon: MapPin, label: t("card.address"), value: branch.address || null },
    {
      icon: Phone, label: t("card.phone"),
      value: branch.phone ? <a href={`tel:${branch.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">{branch.phone}</a> : null,
    },
    {
      icon: Mail, label: t("card.email"),
      value: branch.email ? <a href={`mailto:${branch.email}`} className="break-all hover:underline">{branch.email}</a> : null,
    },
    { icon: UserRound, label: t("card.director"), value: branch.director || null },
    { icon: Clock, label: t("card.hours"), value: branch.hours || null },
    { icon: Archive, label: t("card.funds"), value: branch.funds_summary || null },
  ];
  return (
    <article className="space-y-4 rounded-lg border bg-surface p-4">
      <header className="space-y-1">
        <Heading className="font-serif text-xl font-semibold">{branch.name}</Heading>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{t(`types.${branch.type}`)}</span>
          {branch.name_lang !== locale && <DemoBadge kind="noTranslation" />}
        </p>
      </header>
      {branch.description && <p className="text-sm">{branch.description}</p>}
      <dl className="space-y-2 text-sm">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex gap-2">
            <dt className="flex shrink-0 items-start gap-1.5 text-muted-foreground">
              <Icon className="mt-0.5 size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">{label}:</span>
            </dt>
            <dd className="min-w-0">{value ?? pending}</dd>
          </div>
        ))}
      </dl>
      {branch.show_on_map && !branch.coords_verified && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <DemoBadge kind="approxCoords" /> {t("card.coordsPending")}
        </p>
      )}
      {!branch.show_on_map && <p className="text-xs text-muted-foreground">{t("card.notOnMap")}</p>}
      <RoutePanel address={branch.address} destination={branch.show_on_map && branch.lat != null && branch.lng != null ? { lat: branch.lat, lng: branch.lng } : null} />
      {showDetailsLink && (
        <Link href={`/branches/${branch.slug}`} className="inline-block text-sm font-medium text-primary hover:underline">
          {t("card.details")}
        </Link>
      )}
    </article>
  );
}
