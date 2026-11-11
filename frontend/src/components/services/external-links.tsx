import { GovServiceCard, type GovService } from "@/components/ui/brand";
import { cn } from "@/lib/utils";

const SERVICES = ["egov", "eotinish"] as const;

/**
 * Явные внешние переходы: заявления и обращения оформляются на государственных порталах, не на этом сайте.
 * `only` — один портал из пары по умолчанию; `ids` — свой набор порталов (три и больше встают в три колонки).
 */
export function ExternalServiceLinks({ only, ids }: { only?: (typeof SERVICES)[number]; ids?: readonly GovService[] }) {
  const list: readonly GovService[] = ids ?? SERVICES.filter((id) => !only || id === only);
  return (
    <ul className={cn("grid gap-4", list.length > 2 ? "lg:auto-rows-fr lg:grid-cols-3" : "sm:auto-rows-fr sm:grid-cols-2")}>
      {list.map((id) => (
        <li key={id}><GovServiceCard id={id} /></li>
      ))}
    </ul>
  );
}
