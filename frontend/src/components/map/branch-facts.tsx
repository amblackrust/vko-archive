import { useTranslations } from "next-intl";
import { MailLink, PhoneLink } from "@/components/misc/contact-links";
import { DemoBadge } from "@/components/ui/demo-badge";
import type { Branch } from "@/lib/api/branches";

/** Сведения о подразделении строками. Чего архив не передал — сказано прямо, а не скрыто. */
export function BranchFacts({ branch }: { branch: Branch }) {
  const t = useTranslations("map.card");
  // Тексты из API помечаются своим языком; «нет данных» — текст интерфейса.
  const text = (value: string, fallback = t("missing")) =>
    value ? <span lang={branch.name_lang}>{value}</span> : <span className="text-muted-foreground">{fallback}</span>;
  const rows: [string, React.ReactNode][] = [
    [t("address"), branch.address ? <address className="not-italic" lang={branch.name_lang}>{branch.address}</address> : text("")],
    [t("phone"), branch.phone ? <PhoneLink value={branch.phone} /> : text("")],
    [t("email"), branch.email ? <MailLink value={branch.email} /> : text("")],
    [t("hours"), text(branch.hours, t("hoursMissing"))],
    [t("director"), text(branch.director)],
    ...(branch.funds_summary ? [[t("funds"), text(branch.funds_summary)] as [string, React.ReactNode]] : []),
    [
      t("coords"),
      branch.show_on_map && branch.lat != null && branch.lng != null ? (
        <>
          <span className="tabular-nums">{branch.lat.toFixed(4)}, {branch.lng.toFixed(4)}</span>
          {!branch.coords_verified && (
            <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <DemoBadge kind="approxCoords" />
              {t("coordsApprox")}
            </span>
          )}
        </>
      ) : text("", t("notOnMap")),
    ],
  ];
  return (
    <dl className="card divide-y px-5">
      {rows.map(([label, value]) => (
        <div key={label} className="py-3">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
