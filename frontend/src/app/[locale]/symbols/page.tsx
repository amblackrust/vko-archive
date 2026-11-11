import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/components/misc/metadata";
import { Block, PageBody } from "@/components/misc/page-layout";
import { ExternalLink } from "@/components/ui/external-link";
import { FactList } from "@/components/ui/facts";
import { LinkList } from "@/components/ui/link-list";
import { PageHeader } from "@/components/ui/page-header";

// Официальные страницы о символах на сайте Президента (akorda.kz) и текст закона в «Әділет»; адреса проверены.
const AKORDA: Record<string, string> = { ru: "ru", kk: "kz", en: "en" };
const ADILET: Record<string, string> = { ru: "rus", kk: "kaz", en: "eng" };
const SYMBOLS = [
  { id: "flag", path: "kazakhstan_flag" },
  { id: "emblem", path: "kazakhstan_emblem" },
  { id: "anthem", path: "kazakhstan_anthem" },
] as const;

export const generateMetadata = pageMetadata("misc.symbols", "/symbols");

/** Государственные символы: краткие сведения по официальным источникам и ссылки на них. */
export default async function SymbolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("misc.symbols");
  const akorda = `https://www.akorda.kz/${AKORDA[locale] ?? "ru"}/state_symbols`;
  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageBody
        aside={
          <FactList
            items={[
              { label: t("facts.law"), value: t("facts.lawValue") },
              { label: t("facts.day"), value: t("facts.dayValue") },
              { label: t("facts.adopted"), value: t("facts.adoptedValue") },
            ]}
          />
        }
      >
        <ul className="space-y-4">
          {SYMBOLS.map(({ id, path }) => (
            <li key={id} className="card grid gap-x-10 gap-y-2 p-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
              <h2 className="text-2xl">{t(`${id}.title`)}</h2>
              <div className="max-w-3xl space-y-3">
                <p>{t(`${id}.text`)}</p>
                <p className="text-sm text-muted-foreground">{t(`${id}.authors`)}</p>
                <p><ExternalLink href={`${akorda}/${path}`} className="text-primary underline underline-offset-[3px]">{t(`${id}.link`)}</ExternalLink></p>
              </div>
            </li>
          ))}
        </ul>

        <Block id="sources" title={t("sources.title")} text={t("sources.text")}>
          <LinkList
            items={[
              { href: `${akorda}/about_state_symbols`, label: t("sources.akorda"), external: true },
              { href: `https://adilet.zan.kz/${ADILET[locale] ?? "rus"}/docs/Z070000258_`, label: t("sources.law"), external: true },
            ]}
          />
          <p className="max-w-3xl text-sm text-muted-foreground">{t("sources.images")}</p>
        </Block>
      </PageBody>
    </>
  );
}
