import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmailConfirm } from "@/components/cabinet/email-confirm";
import { PageHeader } from "@/components/ui/page-header";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string | string[] }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cabinet" });
  return { title: t("emailConfirm.title"), robots: { index: false } };
}

/** Страница по ссылке из письма: токен в адресе проверяет только сервер. */
export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("cabinet");
  return (
    <>
      <PageHeader crumbs={[{ label: t("title"), href: "/cabinet" }, { label: t("emailConfirm.title") }]} title={t("emailConfirm.title")} lead={t("emailConfirm.lead")} />
      <div className="container-page py-8 lg:py-10">
        <EmailConfirm token={typeof token === "string" ? token : ""} />
      </div>
    </>
  );
}
