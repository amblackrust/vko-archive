import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Props = { title: string; href?: string; linkLabel?: string };

export function SectionHead({ title, href, linkLabel }: Props) {
  return (
    <div>
      <h2 className="text-4xl md:text-5xl">{title}</h2>
      {href && linkLabel && (
        <Link
          href={href}
          className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-mount-2 px-4 text-sm font-medium text-ink-2 no-underline transition-[background-color,color,transform] duration-200 ease-(--ease-spring) hover:bg-action hover:text-action-ink active:scale-95"
        >
          {linkLabel}
          <ArrowUpRight size={15} aria-hidden />
        </Link>
      )}
    </div>
  );
}
