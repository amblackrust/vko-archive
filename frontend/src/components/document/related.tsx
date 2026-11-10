import { useTranslations } from "next-intl";
import { DocumentCard } from "@/components/catalog/document-card";
import type { DocumentItem } from "@/lib/api/catalog";

export function RelatedDocuments({ items }: { items: DocumentItem[] }) {
  const t = useTranslations("document");
  return (
    <section aria-labelledby="related-title" className="space-y-3">
      <h2 id="related-title" className="text-xl font-semibold">{t("sections.related")}</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground">{t("related.empty")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}><DocumentCard item={item} /></li>
          ))}
        </ul>
      )}
    </section>
  );
}
