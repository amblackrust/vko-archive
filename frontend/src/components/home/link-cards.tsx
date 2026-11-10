import { ExternalLink } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

export interface LinkCard {
  id: string;
  title: string;
  text: string;
  href: string;
  external?: boolean;
}

/** Сетка карточек-ссылок (разделы сайта и внешние ресурсы). */
export function LinkCards({ cards, externalLabel }: { cards: LinkCard[]; externalLabel: string }) {
  const cardClass = "flex h-full flex-col gap-1 rounded-lg border bg-surface p-4 hover:bg-surface-muted";
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <li key={card.id}>
          {card.external ? (
            <a href={card.href} target="_blank" rel="noopener noreferrer" className={cardClass}>
              <span className="inline-flex items-center gap-1 font-medium">
                {card.title} <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">({externalLabel})</span>
              </span>
              <span className="text-sm text-muted-foreground">{card.text}</span>
            </a>
          ) : (
            <Link href={card.href} className={cardClass}>
              <span className="font-medium">{card.title}</span>
              <span className="text-sm text-muted-foreground">{card.text}</span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
