import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHead } from "@/components/ui/page-head";
import { ConfirmEmail } from "@/components/cabinet/token-forms";

export default async function ConfirmEmailPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("cabinet.confirmEmail");
  return (
    <>
      <PageHead title={t("title")} />
      <div className="wrap"><ConfirmEmail token={token} /></div>
    </>
  );
}
