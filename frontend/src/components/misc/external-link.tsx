import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

/** Внешняя ссылка на официальный ресурс. Без адреса (ещё не подтверждён) показывается «ссылка уточняется». */
export function ExternalLinkItem({ href, label }: { href?: string; label: string }) {
  const t = useTranslations("misc.links");
  if (!href) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-surface p-4 text-muted-foreground">
        <span>{label}</span>
        <span className="shrink-0 text-sm">{t("urlPending")}</span>
      </li>
    );
  }
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-3 rounded-lg border bg-surface p-4 font-medium hover:bg-surface-muted"
      >
        {label}
        <ExternalLink className="size-4 shrink-0" aria-hidden />
      </a>
    </li>
  );
}
