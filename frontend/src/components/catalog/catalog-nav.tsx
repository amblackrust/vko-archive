import { useTranslations } from "next-intl";
import { TabsNav } from "@/components/ui/tabs-nav";

const sections = [
  { id: "documents", href: "/catalog" },
  { id: "funds", href: "/catalog/funds" },
  { id: "personalFunds", href: "/catalog/funds?type=personal" },
  { id: "newspapers", href: "/catalog/newspapers" },
  { id: "inventories", href: "/catalog/inventories" },
  { id: "cases", href: "/catalog/cases" },
] as const;

/** Вкладки разделов каталога; «Личные фонды» — отдельная точка входа в перечень фондов. */
export function CatalogNav({ active }: { active: (typeof sections)[number]["id"] }) {
  const t = useTranslations("catalog.nav");
  return <TabsNav label={t("label")} active={active} items={sections.map((section) => ({ ...section, label: t(section.id) }))} />;
}
