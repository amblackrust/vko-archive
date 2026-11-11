import { useTranslations } from "next-intl";
import { TabsNav } from "@/components/ui/tabs-nav";

const TABS = [
  { id: "guide", href: "/help" },
  { id: "faq", href: "/help/faq" },
  { id: "readingRoom", href: "/help/reading-room" },
] as const;

/** Вкладки раздела «Посетителям». */
export function HelpNav({ active }: { active: (typeof TABS)[number]["id"] }) {
  const t = useTranslations("help.nav");
  return (
    <div className="container-page">
      <TabsNav label={t("label")} active={active} items={TABS.map((tab) => ({ ...tab, label: t(tab.id) }))} />
    </div>
  );
}
