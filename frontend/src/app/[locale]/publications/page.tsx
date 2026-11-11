import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/components/misc/metadata";
import { Block, PageBody, SeeAlso } from "@/components/misc/page-layout";
import { Pending } from "@/components/misc/pending";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "@/lib/i18n/navigation";

// Что появится в разделе и где похожие материалы есть уже сейчас.
const PARTS = [
  { id: "articles", href: "/news" },
  { id: "collections", href: "/memory" },
  { id: "photos", href: "/catalog?doc_type=photo" },
] as const;

export const generateMetadata = pageMetadata("misc.publications", "/publications");

/** Публицистика, сборники и фотогалерея: материалы заказчик не передал, страница честно показывает ожидание. */
export default async function PublicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.publications");
  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageBody
        aside={
          <SeeAlso
            title={t("more.title")}
            items={[
              { href: "/exhibitions", label: t("more.exhibitions"), text: t("more.exhibitionsText") },
              { href: "/catalog/newspapers", label: t("more.newspapers"), text: t("more.newspapersText") },
              { href: "/memory/timeline", label: t("more.timeline") },
            ]}
          />
        }
      >
        <Notice title={t("pending.title")}>{t("pending.text")}</Notice>
        <Block id="parts" title={t("parts.title")}>
          <ul className="card divide-y px-5">
            {PARTS.map(({ id, href }) => (
              <li key={id} className="grid gap-x-8 gap-y-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <h3 className="text-lg">{t(`parts.${id}.title`)}</h3>
                  <p className="mt-1 max-w-2xl text-[0.9375rem] text-muted-foreground">{t(`parts.${id}.text`)}</p>
                  <p className="mt-2 text-[0.9375rem]">
                    {t("parts.meanwhile")}{" "}
                    <Link href={href} className="text-link">{t(`parts.${id}.link`)}</Link>
                  </p>
                </div>
                <p><Pending>{t("parts.status")}</Pending></p>
              </li>
            ))}
          </ul>
        </Block>
      </PageBody>
    </>
  );
}
