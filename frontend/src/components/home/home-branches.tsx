"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { BranchMap } from "@/components/map/branch-map-lazy";
import type { Schema } from "@/lib/api/client";

type Props = { branches: Schema["BranchItem"][]; title: string; allLabel: string };

// "Филиал района Алтай" → "Алтай": the list shows places, the full name stays in the tooltip.
const short = (name: string) => name.replace(/(^|\s)(филиал[а-яё]*|районн[а-яё]*|городск[а-яё]*|района|район)(?=\s|$)/giu, " ").replace(/\s+/g, " ").trim() || name;

/** A wide map with every branch under it as a short link: nothing scrolls. */
export function HomeBranches({ branches, title, allLabel }: Props) {
  const t = useTranslations("home.branches");
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const points = useMemo(
    () =>
      branches
        .filter((b) => b.show_on_map && b.lat != null && b.lng != null)
        .map((b) => ({ slug: b.slug, name: b.name, lat: b.lat as number, lng: b.lng as number, head: b.type === "head" })),
    [branches],
  );

  return (
    <section className="wrap py-20">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl md:text-5xl">{title}</h2>
          <p className="mt-2 text-ink-3">{t("count", { count: branches.length })}</p>
        </div>
        <Link href="/branches" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-mount-2 px-4 text-sm font-semibold text-ink-2 no-underline transition-[background-color,color,transform] duration-200 ease-(--ease-spring) hover:bg-action hover:text-action-ink active:scale-95">
          {allLabel} <ArrowUpRight size={15} aria-hidden />
        </Link>
      </div>
      <div className="relative z-0 h-[26rem] overflow-hidden rounded-[2rem] border border-frame shadow-lift md:h-[36rem]">
        <BranchMap branches={points} activeSlug={active} onSelect={(slug) => router.push(`/branches?open=${slug}`)} follow={false} className="size-full" />
      </div>
      <ul className="mt-5 flex flex-wrap gap-2">
        {branches.map((b) => (
          <li key={b.slug}>
            <Link
              href={b.href}
              title={b.name}
              onMouseEnter={() => setActive(b.slug)}
              onFocus={() => setActive(b.slug)}
              onMouseLeave={() => setActive(null)}
              className={clsx("inline-flex h-10 items-center rounded-full px-4 font-medium no-underline transition-colors", active === b.slug ? "bg-action text-action-ink" : "bg-mount-2 text-ink-2 hover:bg-mount-2 hover:text-action")}
            >
              {b.type === "head" ? t("head") : short(b.name)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
