import { useTranslations } from "next-intl";
import { TabsNav } from "@/components/ui/tabs-nav";

const TABS = [
  { id: "about", href: "/about" },
  { id: "history", href: "/about/history" },
  { id: "structure", href: "/about/structure" },
  { id: "contacts", href: "/contacts" },
] as const;

/** Вкладки раздела «Об архиве». */
export function AboutNav({ active }: { active: (typeof TABS)[number]["id"] }) {
  const t = useTranslations("about.nav");
  return (
    <div className="container-page">
      <TabsNav label={t("label")} active={active} items={TABS.map((tab) => ({ ...tab, label: t(tab.id) }))} />
    </div>
  );
}
