import Image from "next/image";
import { useTranslations } from "next-intl";
import { CountUp } from "./count-up";
import { HeroSearch } from "./hero-search";
import { heroPhoto } from "./hero-photo";

/** Первый экран: градиентный баннер-карточка с наименованием архива, поиском, исторической фотографией и цифрами. */
export function Hero({ funds, branches }: { funds: number | null; branches: number | null }) {
  const t = useTranslations("home.hero");
  const stats: { value: React.ReactNode; label: string }[] = [
    { value: "1940", label: t("stats.founded") },
    ...(funds ? [{ value: <CountUp value={funds} />, label: t("stats.funds") }] : []),
    ...(branches ? [{ value: <CountUp value={branches} />, label: t("stats.branches") }] : []),
  ];
  return (
    <section aria-labelledby="home-title" className="container-page pt-4 sm:pt-6">
      <div className="on-brand overflow-hidden rounded-3xl">
        <div className="grid grid-cols-1 items-center gap-8 p-5 sm:p-10 lg:grid-cols-12 lg:gap-12 lg:p-14">
          <div className="min-w-0 lg:col-span-7">
            <h1 id="home-title" className="rise max-w-[20ch] text-3xl sm:text-5xl xl:text-[3.25rem]">{t("title")}</h1>
            <p className="rise rise-1 mt-4 max-w-xl text-lg text-muted-foreground">{t("subtitle")}</p>
            <div className="rise rise-2 mt-7 max-w-2xl"><HeroSearch /></div>
          </div>
          <figure className="rise rise-3 min-w-0 lg:col-span-5">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-white/20">
              <Image src={heroPhoto.src} alt={t("photo.alt")} fill priority sizes="(min-width: 1024px) 36vw, 100vw" className="object-cover" />
            </div>
            <figcaption className="mt-3 text-sm text-muted-foreground">
              {t("photo.caption")}{" "}
              <a href={heroPhoto.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                {t("photo.source", { author: heroPhoto.author, license: heroPhoto.license })}
              </a>
            </figcaption>
          </figure>
        </div>
        <dl className="grid gap-px bg-white/15 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse bg-white/[0.06] px-5 py-4 sm:px-10 sm:py-5 lg:px-14">
              <dt className="text-sm text-muted-foreground">{stat.label}</dt>
              <dd className="text-3xl font-bold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
