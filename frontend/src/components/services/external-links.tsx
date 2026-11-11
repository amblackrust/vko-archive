import { useTranslations } from "next-intl";
import { ExternalLink } from "@/components/ui/external-link";

const SERVICES = [
  { key: "egov", href: "https://egov.kz" },
  { key: "eotinish", href: "https://eotinish.kz" },
] as const;

/** Явные внешние переходы: заявления и обращения оформляются на государственных порталах, не на этом сайте. */
export function ExternalServiceLinks({ only }: { only?: (typeof SERVICES)[number]["key"] }) {
  const t = useTranslations("services.external");
  return (
    <ul className="flex flex-wrap gap-3">
      {SERVICES.filter((service) => !only || service.key === only).map((service) => (
        <li key={service.key}>
          <ExternalLink href={service.href} className="min-h-11 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-semibold hover:border-primary hover:no-underline [&_svg]:mt-0">
            {t(service.key)}
          </ExternalLink>
        </li>
      ))}
    </ul>
  );
}
