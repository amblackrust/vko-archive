import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageHead } from "@/components/ui/page-head";
import { toneBg } from "@/lib/tones";

const DOORS = [
  { key: "collections", href: "/memory/collections", photo: "/photos/memory-collections.webp" },
  { key: "persons", href: "/memory/persons", photo: "/photos/memory-persons.webp" },
  { key: "timeline", href: "/memory/timeline", photo: "/photos/memory-timeline.webp" },
  { key: "map", href: "/memory/map", photo: "/photos/memory-map.webp" },
] as const;

export default async function MemoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("memory");
  return (
    <>
      <PageHead title={t("title")} />
      {/* Four doors fill the screen; the one under the pointer opens wider. */}
      <ul className="flex min-h-[34rem] flex-col gap-3 px-[var(--gutter)] lg:h-[62dvh] lg:flex-row">
        {DOORS.map((d, i) => (
          <li key={d.key} className="min-w-0 flex-1 transition-[flex-grow] duration-700 ease-(--ease-out) lg:hover:flex-[2.4] lg:has-[:focus-visible]:flex-[2.4]">
            <Link href={d.href} className="group relative isolate flex size-full min-h-[11rem] flex-col justify-between overflow-hidden rounded-[32px] p-8 text-[oklch(97%_0.004_240)] no-underline" style={{ background: toneBg(i) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.photo} alt="" loading="lazy" className="absolute inset-0 -z-20 size-full object-cover opacity-80 transition-transform duration-[900ms] ease-(--ease-out) group-hover:scale-110" />
              <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,oklch(18%_0.04_250/0.92),oklch(18%_0.04_250/0.35)_55%,oklch(30%_0.08_250/0.45))] transition-opacity duration-500 group-hover:opacity-90" />
              <span className="edge !text-edge">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="block font-display text-4xl font-semibold tracking-[-0.04em] md:text-5xl">{t(`doors.${d.key}.name`)}</span>
                <span className="mt-3 flex items-end justify-between gap-4">
                  <span className="max-w-[28ch] opacity-75">{t(`doors.${d.key}.text`)}</span>
                  <ArrowUpRight size={26} className="shrink-0 transition-transform duration-300 ease-(--ease-spring) group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
