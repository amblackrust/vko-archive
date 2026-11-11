import { getTranslations, setRequestLocale } from "next-intl/server";
import { HelpNav } from "@/components/help/help-nav";
import { safe } from "@/components/misc/api";
import { PhoneLink } from "@/components/misc/contact-links";
import { pageMetadata } from "@/components/misc/metadata";
import { Block, PageBody, SeeAlso, Steps } from "@/components/misc/page-layout";
import { FactList } from "@/components/ui/facts";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { fetchContacts, receptionPhone } from "@/lib/api/content";
import { Link } from "@/lib/i18n/navigation";

const STEPS = ["find", "call", "come"] as const;
const RULES = ["onsite", "care", "staff", "photo"] as const;

export const generateMetadata = pageMetadata("help.readingRoom", "/help/reading-room");

/** Читальный зал: режим из контактов архива, подготовка к визиту и общие правила. Записи и заказа дел на сайте нет. */
export default async function ReadingRoomPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help");
  const contacts = await safe(fetchContacts());
  const reception = receptionPhone(contacts);

  return (
    <>
      <PageHeader crumbs={[{ label: t("title"), href: "/help" }, { label: t("readingRoom.title") }]} title={t("readingRoom.title")} lead={t("readingRoom.lead")} />
      <HelpNav active="readingRoom" />
      <PageBody
        aside={
          <>
            <FactList
              items={[
                { label: t("readingRoom.facts.hours"), value: contacts ? <span lang="ru">{contacts.reading_room_hours}</span> : t("readingRoom.facts.hoursMissing") },
                { label: t("readingRoom.facts.address"), value: contacts && <span lang="ru">{contacts.address}</span> },
                { label: t("readingRoom.facts.phone"), value: reception && <PhoneLink value={reception} /> },
              ]}
            />
            <SeeAlso
              title={t("next.title")}
              items={[
                { href: "/catalog/funds", label: t("readingRoom.more.funds") },
                { href: "/branches", label: t("readingRoom.more.branches") },
                { href: "/services/state", label: t("readingRoom.more.certificate"), text: t("readingRoom.more.certificateText") },
                { href: "/help/faq", label: t("next.faq") },
              ]}
            />
          </>
        }
      >
        <Notice tone="warning" title={t("readingRoom.notice.title")}>{t("readingRoom.notice.text")}</Notice>

        <Block id="prepare" title={t("readingRoom.prepare.title")}>
          <Steps items={STEPS.map((id) => ({ title: t(`readingRoom.prepare.${id}.title`), text: t(`readingRoom.prepare.${id}.text`) }))} />
        </Block>

        <Block id="rules" title={t("readingRoom.rules.title")}>
          <ul className="max-w-3xl card divide-y px-5">
            {RULES.map((id) => <li key={id} className="py-3">{t(`readingRoom.rules.${id}`)}</li>)}
          </ul>
        </Block>

        <Block id="regulation" title={t("readingRoom.regulation.title")} text={t("readingRoom.regulation.text")}>
          <p><Link href="/legal" className="text-link font-medium">{t("readingRoom.regulation.link")}</Link></p>
        </Block>
      </PageBody>
    </>
  );
}
