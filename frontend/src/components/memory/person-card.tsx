import { useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import type { PersonItem } from "@/lib/api/memory";

export function PersonCard({ item }: { item: PersonItem }) {
  const t = useTranslations("memory.persons");
  return (
    <article className="h-full rounded-lg border bg-surface p-4">
      <h3 className="text-lg font-semibold leading-snug">
        <Link href={item.href} className="hover:underline" lang={item.name_lang}>{item.name}</Link>
        {item.translation_missing && <DemoBadge kind="noTranslation" className="ml-2 align-middle" />}
      </h3>
      {item.years_text && <p className="mt-1 text-sm text-muted-foreground">{t("years")}: {item.years_text}</p>}
    </article>
  );
}
