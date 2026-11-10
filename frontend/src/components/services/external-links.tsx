import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const SERVICES = [
  { key: "egov", href: "https://egov.kz" },
  { key: "eotinish", href: "https://eotinish.kz" },
] as const;

/** Явные внешние переходы: обращения и заявки оформляются на официальных порталах, не здесь. */
export function ExternalServiceLinks() {
  const t = useTranslations("services.external");
  return (
    <div className="flex flex-wrap gap-3">
      {SERVICES.map((service) => (
        <Button key={service.key} asChild variant="outline">
          <a href={service.href} target="_blank" rel="noopener noreferrer">
            {t(service.key)}
            <ExternalLink aria-hidden />
            <span className="sr-only">{t("hint")}</span>
          </a>
        </Button>
      ))}
    </div>
  );
}
