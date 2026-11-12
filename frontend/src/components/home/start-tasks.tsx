import { getTranslations } from "next-intl/server";
import { BookOpen, Building2, FileText, GraduationCap, MapPin, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Same order as home.start.items in messages.
const TASKS = [
  { href: "/services/state", Icon: FileText },
  { href: "/catalog", Icon: Building2 },
  { href: "/help", Icon: Users },
  { href: "/help/reading-room", Icon: BookOpen },
  { href: "/memory", Icon: GraduationCap },
  { href: "/branches", Icon: MapPin },
] as const;

/** Entry points by visitor task: one row of chips under the search. */
export async function StartTasks() {
  const t = await getTranslations("home.start");
  const items = t.raw("items") as { title: string }[];
  return (
    <section aria-labelledby="start-title" className="mt-8">
      <p id="start-title" className="mb-3 text-sm font-semibold text-ink-3">{t("title")}</p>
      <ul className="flex flex-wrap justify-start gap-2.5">
        {TASKS.map(({ href, Icon }, i) => (
          <li key={href}>
            <Link
              href={href}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-mount-2 px-5 font-medium text-ink-2 no-underline transition-[background-color,color,transform] duration-200 ease-(--ease-spring) hover:bg-action hover:text-action-ink active:scale-95"
            >
              <Icon size={16} aria-hidden />
              {items[i].title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
