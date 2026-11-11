import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmailConfirm } from "@/components/cabinet/email-confirm";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cabinet" });
  return { title: t("emailConfirm.title"), robots: { index: false } };
}

/** Подтверждение e-mail по ссылке из письма (токен в query, проверяет только сервер). */
export default async function ConfirmEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("cabinet");
  return (
    <>
      <Breadcrumbs items={[{ label: t("title"), href: "/cabinet" }, { label: t("emailConfirm.title") }]} />
      <div className="container-page space-y-6 pb-12">
        <h1 className="text-3xl font-bold">{t("emailConfirm.title")}</h1>
        <EmailConfirm token={typeof token === "string" ? token : ""} />
      </div>
    </>
  );
}
