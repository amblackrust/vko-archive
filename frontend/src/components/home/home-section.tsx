import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

/** Блок главной: заголовок, необязательная ссылка «все», содержимое. */
export function HomeSection({ id, title, href, children }: {
  id: string;
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("home");
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="font-serif text-2xl font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {t("openSection")} <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
