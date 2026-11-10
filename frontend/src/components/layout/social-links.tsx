import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Ссылки из info/Контакты.docx
export const socialUrls = {
  instagram: "https://www.instagram.com/arhiv_vko/",
  facebook: "https://www.facebook.com/vkoarhiv",
} as const;

// В lucide-react нет брендовых иконок, поэтому простые inline SVG.
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.800v2.200H8v3h2.700V21h2.800z" />
    </svg>
  );
}

export function SocialLinks({ className }: { className?: string }) {
  const t = useTranslations("layout.social");
  const linkClass = "flex size-9 items-center justify-center rounded-md hover:bg-surface-muted";
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      <li>
        <a href={socialUrls.instagram} target="_blank" rel="noopener noreferrer" aria-label={t("instagram")} className={linkClass}>
          <InstagramIcon />
        </a>
      </li>
      <li>
        <a href={socialUrls.facebook} target="_blank" rel="noopener noreferrer" aria-label={t("facebook")} className={linkClass}>
          <FacebookIcon />
        </a>
      </li>
    </ul>
  );
}
