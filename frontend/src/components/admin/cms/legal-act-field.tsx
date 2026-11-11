"use client";

import { useLocale } from "next-intl";
import { pickName } from "@/lib/api/admin";
import { contentApi } from "@/lib/api/admin-content";
import { FormField, Select } from "../form-field";
import { useLoad } from "../use-load";

interface Props {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

/** Выбор нормативного акта из справочника НПА (основание цены в прейскуранте). */
export function LegalActField({ id, label, value, onChange }: Props) {
  const locale = useLocale();
  const acts = useLoad(() => contentApi.list("legal_act", { page: 1, page_size: 100 }), []);
  const items = acts.data?.items ?? [];
  return (
    <FormField label={label} htmlFor={id}>
      <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">—</option>
        {value && !items.some((item) => item.id === value) && <option value={value}>{value.slice(0, 8)}</option>}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {[item.number, pickName(item.title, locale)].filter(Boolean).join(" · ")}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
