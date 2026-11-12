import { Link } from "@/i18n/navigation";
import type { Schema } from "@/lib/api/client";
import { Sleeve } from "@/components/ui/sleeve";
import { Media } from "@/components/ui/media";

/** Documents tied to a collection or person, laid in a film strip. */
export function DocStrip({ docs }: { docs: Schema["MemoryDocument"][] }) {
  if (!docs.length) return null;
  return (
    <div className="-mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)] pb-6 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Sleeve className="w-max">
        <ul className="flex gap-3">
          {docs.map((d) => (
            <li key={d.id} className="w-[17rem] shrink-0">
              <Link href={d.href} className="group block no-underline">
                <div className="aspect-[4/3] overflow-hidden rounded-[5px] bg-sleeve-2">
                  {d.preview_url && <Media src={d.preview_url} className="size-full object-cover brightness-90 transition-[transform,filter] duration-500 group-hover:scale-[1.04] group-hover:brightness-110" />}
                </div>
                <p className="mt-2 flex items-center justify-between gap-2 text-[0.7rem] uppercase tracking-[0.08em] text-edge" style={{ fontFamily: "var(--font-mono)" }}><span className="truncate">{d.archive_code}</span></p>
                <p className="mt-1 line-clamp-2 text-sm text-[oklch(92%_0.005_240)]">{d.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Sleeve>
    </div>
  );
}
