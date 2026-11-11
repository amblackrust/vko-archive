import { fileUrl } from "@/lib/api/document";
import type { PersonItem } from "@/lib/api/memory";
import { Link } from "@/lib/i18n/navigation";

/**
 * Личность карточкой: слева портрет, справа имя, годы жизни и начало справки.
 * Если портрета нет, его место занимают годы жизни крупным набором — высота и композиция карточек совпадают.
 */
export function PersonCard({ person, portrait, heading: Heading = "h3" }: {
  person: PersonItem;
  /** Путь превью портрета из API; null — портрета нет. */
  portrait?: string | null;
  heading?: "h2" | "h3";
}) {
  const plate = !portrait && person.birth_year != null;
  return (
    <article className="card lift group relative flex h-full gap-4 p-4 sm:gap-5 sm:p-5">
      {portrait ? (
        // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
        <img src={fileUrl(portrait)} alt="" loading="lazy" decoding="async" className="h-32 w-24 shrink-0 rounded-md object-cover sm:h-36 sm:w-28" />
      ) : plate ? (
        <p className="flex h-32 w-24 shrink-0 flex-col items-center justify-center rounded-md bg-primary-soft font-bold tabular-nums leading-none text-primary sm:h-36 sm:w-28">
          <span className="text-2xl">{person.birth_year}</span>
          {person.death_year != null && (
            <>
              <span className="my-2.5 h-px w-8 bg-primary/40" aria-hidden />
              <span className="sr-only">–</span>
              <span className="text-2xl">{person.death_year}</span>
            </>
          )}
        </p>
      ) : null}
      <div className="flex min-w-0 flex-col">
        <Heading className="text-[1.0625rem] font-semibold leading-snug" lang={person.name_lang}>
          {/* Ссылка растянута на всю карточку: портрет тоже нажимается. */}
          <Link href={person.href} className="after:absolute after:inset-0 group-hover:text-primary">{person.name}</Link>
        </Heading>
        {!plate && person.years_text && <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">{person.years_text}</p>}
        {person.bio && <p className="mt-2 line-clamp-3 text-[0.9375rem] text-muted-foreground" lang={person.name_lang}>{person.bio}</p>}
      </div>
    </article>
  );
}
