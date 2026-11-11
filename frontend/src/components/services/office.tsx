import { PhoneLink } from "@/components/misc/contact-links";
import { InfoStrip } from "@/components/misc/blocks";
import type { Contacts } from "@/lib/api/content";

/** Канцелярия архива одной полосой: телефон приёмной, режим работы и адрес из контактов API. */
export function OfficeStrip({ contacts, reception, labels }: {
  contacts: Contacts | null;
  reception: string | null;
  labels: { phone: string; hours: string; address: string };
}) {
  return (
    <InfoStrip
      items={[
        { label: labels.phone, value: reception && <PhoneLink value={reception} /> },
        { label: labels.hours, value: contacts && <span lang="ru">{contacts.hours}</span> },
        { label: labels.address, value: contacts && <span lang="ru">{contacts.address}</span> },
      ]}
    />
  );
}
