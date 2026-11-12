import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHead } from "@/components/ui/page-head";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("info.privacy");
  const blocks = t.raw("blocks") as { title: string; text: string }[];
  return (
    <>
      <PageHead title={t("title")} />
      <div className="wrap">
        <dl className="max-w-[70ch] space-y-8">{blocks.map((b) => <div key={b.title}><dt className="font-display text-2xl font-medium tracking-[-0.02em]">{b.title}</dt><dd className="mt-2 text-lg text-ink-2">{b.text}</dd></div>)}</dl>
      </div>
    </>
  );
}
