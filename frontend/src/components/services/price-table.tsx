import { useTranslations } from "next-intl";

/** Позиция прейскуранта: те же поля, что у записи price_list_item в админке. */
export interface PriceItem {
  id: string;
  name: string;
  unit: string;
  /** Цена в тенге; null — «по договорённости» или не указана. */
  price: number | null;
  note: string;
}

/**
 * Таблица прейскуранта. Публичного API с позициями пока нет, а утверждённый прейскурант заказчик
 * не передал, поэтому страница передаёт пустой список и таблица честно показывает ожидание.
 * Когда появится публичный список позиций, достаточно передать его сюда.
 */
export function PriceTable({ items }: { items: PriceItem[] }) {
  const t = useTranslations("services.paid.table");
  const cell = "border-t px-4 py-3 align-top";
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-left text-[0.9375rem]">
        <caption className="sr-only">{t("caption")}</caption>
        <thead className="bg-surface-muted text-sm text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">{t("name")}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t("unit")}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{t("price")}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={3} className={`${cell} text-muted-foreground`}>{t("pending")}</td>
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.id}>
              <th scope="row" className={`${cell} font-medium`}>
                {item.name}
                {item.note && <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{item.note}</span>}
              </th>
              <td className={cell}>{item.unit}</td>
              <td className={`${cell} text-right tabular-nums`}>{item.price ?? t("onRequest")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
