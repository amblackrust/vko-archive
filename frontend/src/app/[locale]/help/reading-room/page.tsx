import { getTranslations, setRequestLocale } from "next-intl/server";
import { HelpNav } from "@/components/help/help-nav";
import { safe } from "@/components/misc/api";
import { InfoStrip, PageSection, PageStack, PointList, StepCards } from "@/components/misc/blocks";
import { PhoneLink } from "@/components/misc/contact-links";
import { pageMetadata } from "@/components/misc/metadata";
import { Button } from "@/components/ui/button";
import { LinkTile } from "@/components/ui/link-tile";
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
  const h2 = "text-2xl sm:text-3xl";
  const pair = "row-span-2 grid grid-rows-subgrid gap-y-6";

  return (
    <>
      <PageHeader crumbs={[{ label: t("title"), href: "/help" }, { label: t("readingRoom.title") }]} title={t("readingRoom.title")} lead={t("readingRoom.lead")} />
      <HelpNav active="readingRoom" />
      <PageStack className="pt-8">
        <InfoStrip
          items={[
            { label: t("readingRoom.facts.hours"), value: contacts && <span lang="ru">{contacts.reading_room_hours}</span> },
            { label: t("readingRoom.facts.address"), value: contacts && <span lang="ru">{contacts.address}</span> },
            { label: t("readingRoom.facts.phone"), value: reception && <PhoneLink value={reception} /> },
          ]}
        />

        <PageSection id="prepare" title={t("readingRoom.prepare.title")}>
          <StepCards items={STEPS.map((id) => ({ title: t(`readingRoom.prepare.${id}.title`), text: t(`readingRoom.prepare.${id}.text`) }))} />
        </PageSection>

        <div className="grid gap-x-4 gap-y-14 lg:grid-cols-12">
          <section id="rules" aria-labelledby="rules-title" className={`${pair} scroll-mt-28 lg:col-span-7`}>
            <h2 id="rules-title" className={h2}>{t("readingRoom.rules.title")}</h2>
            <PointList items={RULES.map((id) => t(`readingRoom.rules.${id}`))} />
          </section>
          <section id="regulation" aria-labelledby="regulation-title" className={`${pair} scroll-mt-28 lg:col-span-5`}>
            <h2 id="regulation-title" className={h2}>{t("readingRoom.regulation.title")}</h2>
            <div className="card flex h-full flex-col gap-5 p-6">
              <p>{t("readingRoom.regulation.text")}</p>
              <p className="mt-auto"><Button asChild variant="outline"><Link href="/legal">{t("readingRoom.regulation.link")}</Link></Button></p>
            </div>
          </section>
        </div>

        <PageSection id="next" title={t("next.title")}>
          <ul className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-4">
            <li><LinkTile href="/catalog/funds" title={t("readingRoom.more.funds")} text={t("readingRoom.more.fundsText")} /></li>
            <li><LinkTile href="/branches" title={t("readingRoom.more.branches")} text={t("site.items.branches.text")} /></li>
            <li><LinkTile href="/services/state" title={t("readingRoom.more.certificate")} text={t("readingRoom.more.certificateText")} /></li>
            <li><LinkTile href="/help/faq" title={t("next.faq")} text={t("next.faqText")} /></li>
          </ul>
        </PageSection>
      </PageStack>
    </>
  );
}
