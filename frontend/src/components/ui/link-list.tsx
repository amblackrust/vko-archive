import { Link } from "@/lib/i18n/navigation";
import { ExternalLink } from "./external-link";

/** Список ссылок с разделителями: внутренние переходы и внешние ресурсы (помечаются значком). */
export function LinkList({ items }: { items: { href: string; label: string; text?: string; external?: boolean }[] }) {
  return (
    <ul className="card divide-y px-5">
      {items.map((item) => (
        <li key={item.href} className="py-3">
          {item.external ? (
            <ExternalLink href={item.href} className="font-medium">{item.label}</ExternalLink>
          ) : (
            <Link href={item.href} className="font-medium hover:text-primary hover:underline">{item.label}</Link>
          )}
          {item.text && <p className="mt-0.5 text-sm text-muted-foreground">{item.text}</p>}
        </li>
      ))}
    </ul>
  );
}
