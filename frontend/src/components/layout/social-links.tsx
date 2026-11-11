"use client";

import { useTranslations } from "next-intl";
import { SocialLogo } from "@/components/ui/brand";
import { cn } from "@/lib/utils";
import { socialEntries } from "./social-data";
import { useSiteSettings } from "./site-settings";

/** Соцсети архива значками (подвал): знак сети — ссылка на официальную страницу. */
export function SocialLinks({ className }: { className?: string }) {
  const t = useTranslations("layout.social");
  const settings = useSiteSettings();
  return (
    <ul className={cn("flex items-center gap-2", className)}>
      {socialEntries(settings?.social).map(([network, link]) => (
        <li key={network}>
          <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={t.has(network) ? t(network) : network} className="block transition-transform hover:-translate-y-0.5">
            <SocialLogo network={network} className="size-9 rounded-lg" />
          </a>
        </li>
      ))}
    </ul>
  );
}
