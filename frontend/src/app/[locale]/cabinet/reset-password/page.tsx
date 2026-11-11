import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordResetConfirm } from "@/components/cabinet/password-reset-confirm";
import { PageHeader } from "@/components/ui/page-header";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string | string[] }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cabinet" });
  return { title: t("reset.confirmTitle"), robots: { index: false } };
}

/** Страница по ссылке из письма: токен в адресе проверяет только сервер. */
export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("cabinet");
  return (
    <>
      <PageHeader crumbs={[{ label: t("title"), href: "/cabinet" }, { label: t("reset.confirmTitle") }]} title={t("reset.confirmTitle")} lead={t("reset.confirmLead")} />
      <div className="container-page pb-16 pt-2">
        <PasswordResetConfirm token={typeof token === "string" ? token : ""} />
      </div>
    </>
  );
}
