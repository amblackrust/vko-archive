import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHead } from "@/components/ui/page-head";
import { ResetPassword } from "@/components/cabinet/token-forms";

export default async function ResetPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("cabinet.reset");
  return (
    <>
      <PageHead title={token ? t("newTitle") : t("title")} />
      <div className="wrap"><ResetPassword token={token} /></div>
    </>
  );
}
