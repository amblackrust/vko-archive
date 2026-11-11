import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AboutNav } from "@/components/about/about-nav";
import { topBlocks } from "@/components/about/html";
import { parseStructure } from "@/components/about/structure";
import { heroPhoto } from "@/components/home/hero-photo";
import { fetchTotal, safe } from "@/components/misc/api";
import { PhoneLink } from "@/components/misc/contact-links";
import { pageMetadata } from "@/components/misc/metadata";
import { RichText } from "@/components/misc/rich-text";
import { Button } from "@/components/ui/button";
import { KeyFacts } from "@/components/ui/facts";
import { PageHeader } from "@/components/ui/page-header";
import { fetchBranches } from "@/lib/api/branches";
import { fetchPage } from "@/lib/api/content";
import { Link } from "@/lib/i18n/navigation";

const WORK = ["store", "account", "appraisal", "reference", "readingRoom", "certificates"] as const;

const SECTIONS = [
  { id: "history", href: "/about/history" },
  { id: "structure", href: "/about/structure" },
  { id: "legal", href: "/legal" },
  { id: "branches", href: "/branches" },
  { id: "compliance", href: "/compliance" },
  { id: "contacts", href: "/contacts" },
] as const;

export const generateMetadata = pageMetadata("about", "/about");

const tile = "card lift group flex h-full flex-col p-5";

/**
 * Входная страница раздела: цифры из API, чем занят архив, руководство, отделы, начало истории и переходы.
 * Все блоки — сетки из равных плиток.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const [history, structure, branches, funds, newspapers] = await Promise.all([
    safe(fetchPage("history", locale)),
    safe(fetchPage("structure", locale)),
    safe(fetchBranches(locale)),
    fetchTotal("catalog/funds?per_page=1"),
    fetchTotal("catalog/newspapers?per_page=1"),
  ]);
  const [management, ...departments] = structure ? parseStructure(structure.body) : [];
  const opening = history ? topBlocks(history.body)?.[0] : null;

  return (
    <>
      <PageHeader tone="brand" crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <AboutNav active="about" />
      <div className="container-page space-y-14 pb-16 pt-6">
        <KeyFacts
          items={[
            { label: t("facts.founded"), value: "1940" },
            { label: t("facts.funds"), value: funds?.toLocaleString("ru-RU") },
            { label: t("facts.branches"), value: branches?.filter((branch) => branch.type !== "head").length },
            { label: t("facts.newspapers"), value: newspapers },
          ]}
        />

        <section aria-labelledby="about-work" className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="about-work" className="text-2xl sm:text-3xl">{t("work.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("work.text")}</p>
          </div>
          <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:col-span-8 xl:grid-cols-3">
            {WORK.map((id) => (
              <li key={id} className="card h-full p-5">
                <h3 className="text-[1.0625rem]">{t(`work.items.${id}.title`)}</h3>
                <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">{t(`work.items.${id}.text`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {management && (
          <section aria-labelledby="about-management">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <h2 id="about-management" className="text-2xl sm:text-3xl">{t("management.title")}</h2>
              <Link href="/about/structure" className="text-link font-semibold">{t("management.link")}</Link>
            </div>
            <ul className="mt-6 grid auto-rows-fr gap-4 md:grid-cols-3" lang={structure?.lang}>
              {management.people.map((person) => (
                <li key={person.name} className="card flex h-full flex-col p-6">
                  <p className="text-sm text-muted-foreground">{person.role}</p>
                  <p className="mt-1 text-lg font-bold leading-snug">{person.name}</p>
                  {person.phone && <PhoneLink value={person.phone} className="mt-auto pt-4 font-medium" />}
                </li>
              ))}
            </ul>
          </section>
        )}

        {opening && history && (
          <section aria-labelledby="about-history" className="card grid overflow-hidden rounded-3xl lg:grid-cols-2">
            <figure className="relative min-h-64 lg:min-h-80">
              <Image src={heroPhoto.src} alt="" fill sizes="(min-width: 1024px) 40rem, 100vw" className="object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#152040]/85 to-transparent px-5 pb-3 pt-10 text-xs text-white">
                {t("photo", { author: heroPhoto.author, license: heroPhoto.license })}
              </figcaption>
            </figure>
            <div className="flex flex-col justify-center gap-5 p-6 sm:p-10">
              <h2 id="about-history" className="text-2xl sm:text-3xl">{t("historyTeaser.title")}</h2>
              <RichText html={opening} lang={history.lang} />
              <div>
                <Button asChild size="lg">
                  <Link href="/about/history">{t("historyTeaser.button")} <ArrowRight aria-hidden /></Link>
                </Button>
              </div>
            </div>
          </section>
        )}

        {departments.length > 0 && (
          <section aria-labelledby="about-units">
            <h2 id="about-units" className="text-2xl sm:text-3xl">{t("units.title")}</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">{t("work.unitsText")}</p>
            <ul className="mt-6 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4" lang={structure?.lang}>
              {departments.map((unit) => (
                <li key={unit.id}>
                  <Link href={`/about/structure#${unit.id}`} className={`${tile} justify-between gap-4`}>
                    <span className="font-semibold leading-snug group-hover:text-primary">{unit.name}</span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
                  </Link>
                </li>
              ))}
              <li lang={locale}>
                <Link href="/about/structure" className="flex h-full flex-col justify-between gap-4 rounded-lg bg-primary p-5 text-primary-foreground transition-colors hover:bg-primary-hover">
                  <span className="font-semibold leading-snug">{t("units.all")}</span>
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </li>
            </ul>
          </section>
        )}

        <section aria-labelledby="about-sections">
          <h2 id="about-sections" className="text-2xl sm:text-3xl">{t("sections.title")}</h2>
          <ul className="mt-6 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map(({ id, href }) => (
              <li key={id}>
                <Link href={href} className={tile}>
                  <span className="text-[1.0625rem] font-semibold group-hover:text-primary">{t(`sections.${id}.label`)}</span>
                  <span className="mt-1.5 text-[0.9375rem] text-muted-foreground">{t(`sections.${id}.text`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
