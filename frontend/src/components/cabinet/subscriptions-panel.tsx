"use client";

import { useTranslations } from "next-intl";
import { DemoBadge } from "@/components/ui/demo-badge";
import { cabinetFetch, type Subscriptions, type Topic } from "./api";
import { useCabinetList } from "./use-cabinet-data";

const TOPICS: Topic[] = ["news", "exhibitions"];

export function SubscriptionsPanel() {
  const t = useTranslations("cabinet");
  const { data, error, mutate } = useCabinetList<Subscriptions>("/subscriptions");
  return (
    <section aria-labelledby="subs-title" className="space-y-3">
      <h2 id="subs-title" className="text-xl font-semibold">{t("subscriptions.title")}</h2>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <DemoBadge kind="demoIntegration" /> {t("subscriptions.demo")}
      </p>
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      <ul className="space-y-2">
        {TOPICS.map((topic) => {
          const on = data?.topics.includes(topic) ?? false;
          return (
            <li key={topic}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={data === null}
                  onChange={() => mutate(() => cabinetFetch(`/subscriptions/${topic}`, { method: on ? "DELETE" : "PUT" }))}
                  className="size-4"
                />
                {t(`subscriptions.${topic}`)}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
