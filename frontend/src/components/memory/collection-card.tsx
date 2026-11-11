import { useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Link } from "@/lib/i18n/navigation";
import type { CollectionItem } from "@/lib/api/memory";
import { themeLabel } from "./theme-label";

export function CollectionCard({ item }: { item: CollectionItem }) {
  const t = useTranslations("memory");
  return (
    <article className="flex h-full flex-col rounded-lg border bg-surface p-4">
      <h3 className="text-lg font-semibold leading-snug">
        <Link href={item.href} className="hover:underline" lang={item.title_lang}>{item.title}</Link>
        {item.translation_missing && <DemoBadge kind="noTranslation" className="ml-2 align-middle" />}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {[item.theme && themeLabel(t, item.theme), item.period].filter(Boolean).join(" · ")}
      </p>
      {item.description && <p className="mt-2 flex-1 text-sm">{item.description}</p>}
      <p className="mt-3 text-sm text-muted-foreground">{t("collections.items", { count: item.item_count })}</p>
    </article>
  );
}
