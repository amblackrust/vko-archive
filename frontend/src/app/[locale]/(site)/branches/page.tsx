import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { pageMeta } from "@/lib/seo";
import { Suspense } from "react";
import { api, type Schema } from "@/lib/api/client";
import { BranchesExplorer } from "@/components/branches/branches-explorer";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, c] = await Promise.all([getTranslations({ locale, namespace: "branches" }), getTranslations({ locale, namespace: "common" })]);
  return pageMeta({ locale, path: "/branches", title: t("title"), description: c("siteName") });
}

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
