import { getLocale, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { api, type Schema } from "@/lib/api/client";
import { BranchesExplorer } from "@/components/branches/branches-explorer";

export default async function BranchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = await getLocale();
  const res = await api.get<Schema["BranchesResponse"]>("/api/branches", { query: { lang } }).catch(() => null);
  return (
    <Suspense>
      <BranchesExplorer branches={res?.items ?? []} />
    </Suspense>
  );
}
