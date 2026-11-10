import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const sections = [
  { id: "documents", href: "/catalog" },
  { id: "funds", href: "/catalog/funds" },
  { id: "personalFunds", href: "/catalog/funds?type=personal" },
  { id: "inventories", href: "/catalog/inventories" },
  { id: "cases", href: "/catalog/cases" },
] as const;

/** Вкладки разделов каталога; «Личные фонды» — отдельная точка входа. */
export function CatalogNav({ active }: { active: (typeof sections)[number]["id"] }) {
  const t = useTranslations("catalog.nav");
  return (
    <nav aria-label={t("label")} className="flex flex-wrap gap-2">
      {sections.map((section) => (
        <Link
          key={section.id}
          href={section.href}
          aria-current={section.id === active ? "page" : undefined}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium",
            section.id === active ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-muted",
          )}
        >
          {t(section.id)}
        </Link>
      ))}
    </nav>
  );
}
