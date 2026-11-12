"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { MicButton } from "@/components/ui/voice-buttons";

/** The placeholder cycles through example queries; it stops while the field is focused or filled, and stays one static example under reduced motion. */
export function HeroSearch({ placeholders }: { placeholders: string[] }) {
  const t = useTranslations("home");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [shown, setShown] = useState(0);
  const cycling = !reduced && !focused && !query && placeholders.length > 1;

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce");
  }, []);
  useEffect(() => {
    if (!cycling) return;
    const timer = setInterval(() => setShown((i) => (i + 1) % placeholders.length), 3000);
    return () => clearInterval(timer);
  }, [cycling, placeholders.length]);

  const submit = (value: string) => {
    const q = value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}&types=document`);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(query);
      }}
      className="glassine flex h-[4.5rem] items-center gap-2 rounded-full border border-frame-strong/60 pl-6 pr-2.5 shadow-lift transition-[box-shadow,transform,border-color] duration-500 ease-(--ease-spring) focus-within:scale-[1.012] focus-within:border-action focus-within:shadow-lift-high md:h-20 md:pl-8 md:pr-3"
    >
      <label htmlFor="hero-q" className="sr-only">
        {t("searchLabel")}
      </label>
      <Search className="shrink-0 text-ink-3" size={26} aria-hidden />
      <div className="relative min-w-0 flex-1">
        <input
          id="hero-q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholders[cycling ? shown : 0]}
          autoComplete="off"
          className={`w-full bg-transparent px-3 text-xl tracking-[-0.01em] outline-none placeholder:text-ink-3 md:px-4 md:text-2xl ${cycling ? "placeholder:text-transparent" : ""}`}
        />
        {cycling && (
          <AnimatePresence mode="wait">
            <motion.span
              key={shown}
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center truncate px-3 text-left text-xl tracking-[-0.01em] text-ink-3 md:px-4 md:text-2xl"
            >
              {placeholders[shown]}
            </motion.span>
          </AnimatePresence>
        )}
      </div>
      <MicButton
        label={t("voice.mic")}
        onText={(text, final) => {
          setQuery(text);
          if (final) submit(text);
        }}
        className="!size-12 shrink-0 md:!size-14"
      />
      <button
        type="submit"
        aria-label={t("searchButton")}
        title={t("searchButton")}
        className="grid size-14 shrink-0 place-items-center rounded-full bg-action text-action-ink transition-[filter,transform] duration-200 ease-(--ease-spring) hover:brightness-110 active:scale-90 active:duration-75 md:size-16"
      >
        <ArrowRight size={26} aria-hidden />
      </button>
    </form>
  );
}
