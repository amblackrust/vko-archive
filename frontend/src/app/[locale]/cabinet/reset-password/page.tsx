import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordResetConfirm } from "@/components/cabinet/password-reset-confirm";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cabinet" });
  return { title: t("reset.confirmTitle"), robots: { index: false } };
}

/** Новый пароль по ссылке из письма (токен в query, проверяет только сервер). */
export default async function ResetPasswordPage({
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
      <Breadcrumbs items={[{ label: t("title"), href: "/cabinet" }, { label: t("reset.confirmTitle") }]} />
      <div className="container-page space-y-6 pb-12">
        <h1 className="text-3xl font-bold">{t("reset.confirmTitle")}</h1>
        <PasswordResetConfirm token={typeof token === "string" ? token : ""} />
      </div>
    </>
  );
}
