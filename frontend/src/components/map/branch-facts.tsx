import { useTranslations } from "next-intl";
import { ContactTile } from "@/components/about/contact-tile";
import { MailLink, PhoneLink } from "@/components/misc/contact-links";
import type { Branch } from "@/lib/api/branches";
import { cn } from "@/lib/utils";

/** Сведения о подразделении строками — для карточки в окне карты. Показано только то, что есть в данных архива. */
export function BranchFacts({ branch }: { branch: Branch }) {
  const t = useTranslations("map.card");
  const text = (value: string) => <span lang={branch.name_lang}>{value}</span>;
  const rows: [string, React.ReactNode][] = [
    [t("address"), branch.address && <address className="not-italic" lang={branch.name_lang}>{branch.address}</address>],
    [t("phone"), branch.phone && <PhoneLink value={branch.phone} className="font-semibold" />],
    [t("email"), branch.email && <MailLink value={branch.email} />],
    [t("hours"), branch.hours && text(branch.hours)],
    [t("director"), branch.director && text(branch.director)],
    [t("funds"), branch.funds_summary && text(branch.funds_summary)],
  ];
  return (
    <dl className="divide-y border-y">
      {rows.filter(([, value]) => value).map(([label, value]) => (
        <div key={label} className="py-2.5">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Контакты подразделения плитками — для его страницы: адрес во всю ширину, телефон и руководитель парой,
 * почта и режим работы. `children` — плитки-переходы, которыми сетка заканчивается.
 */
export function BranchTiles({ branch, children }: { branch: Branch; children?: React.ReactNode }) {
  const t = useTranslations("map.card");
  const pair = Boolean(branch.phone && branch.director);
  const wide = "sm:col-span-2 lg:col-span-1 xl:col-span-2";
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {branch.address && (
        <li className={wide}>
          <ContactTile label={t("address")} value={branch.address} lang={branch.name_lang} className="min-h-0 sm:min-h-0 [&>span:last-child]:text-xl" />
        </li>
      )}
      {branch.phone && <li className={cn(!pair && wide)}><ContactTile kind="phone" label={t("phone")} value={branch.phone} /></li>}
      {branch.director && <li className={cn(!pair && wide)}><ContactTile label={t("director")} value={branch.director} lang={branch.name_lang} /></li>}
      {branch.email && <li className={wide}><ContactTile kind="mail" label={t("email")} value={branch.email} className="min-h-0 sm:min-h-0" /></li>}
      {branch.hours && <li className={wide}><ContactTile label={t("hours")} value={branch.hours} lang={branch.name_lang} className="min-h-0 sm:min-h-0" /></li>}
      {children}
    </ul>
  );
}
