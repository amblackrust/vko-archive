"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { MicButton } from "@/components/ui/voice-buttons";

export function SearchForm({ initial }: { initial: string }) {
  const t = useTranslations("search");
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="glass flex h-16 items-center gap-2 rounded-full border border-line-strong/50 pl-5 pr-2 shadow-lift transition-[box-shadow,border-color] duration-300 focus-within:border-action focus-within:shadow-lift-high md:h-[4.5rem] md:pl-7"
    >
      <label htmlFor="q" className="sr-only">{t("placeholder")}</label>
      <Search className="shrink-0 text-ink-3" size={22} aria-hidden />
      <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} autoComplete="off" className="min-w-0 flex-1 bg-transparent px-2 text-lg outline-none placeholder:text-ink-3 md:text-xl" />
      <MicButton
        label={t("voice.mic")}
        onText={(text, final) => {
          setQ(text);
          if (final) router.push(`/search?q=${encodeURIComponent(text)}`);
        }}
        className="!size-11 shrink-0"
      />
      <button type="submit" aria-label={t("button")} title={t("button")} className="grid size-12 shrink-0 place-items-center rounded-full bg-action text-action-ink transition-[filter,transform] duration-200 ease-(--ease-spring) hover:brightness-110 active:scale-90 md:size-14">
        <ArrowRight size={22} aria-hidden />
      </button>
    </form>
  );
}
