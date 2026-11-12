import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("common.state");
  return (
    <main id="main" className="wrap grid min-h-dvh content-center gap-6 py-20">
      <h1 className="text-5xl md:text-7xl">{t("notFound")}</h1>
      <p className="text-lg text-ink-2">{t("notFoundText")}</p>
      <div>
        <Link href="/" className={buttonClass("primary")}>
          {t("toHome")}
        </Link>
      </div>
    </main>
  );
}
