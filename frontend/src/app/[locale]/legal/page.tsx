import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActRow, STATUS_ICONS } from "@/components/legal/act-row";
import { legalFetch, LEGAL_STATUSES, type CompliancePage, type LegalActsResponse } from "@/components/legal/api";
import { safe } from "@/components/misc/api";
import { pageMetadata } from "@/components/misc/metadata";
import { PageBody, SeeAlso } from "@/components/misc/page-layout";
import { Unavailable } from "@/components/misc/state-help";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { Field, SelectField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { RecordList } from "@/components/ui/record-list";
import { EmptyState } from "@/components/ui/state-view";
import { Link } from "@/lib/i18n/navigation";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export const generateMetadata = pageMetadata("legal", "/legal");

/** Перечень нормативных правовых актов с поиском и статусами. Внутренние документы комплаенс-службы — на её странице. */
export default async function LegalPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 200);
  const status = LEGAL_STATUSES.find((value) => value === first(sp.status)) ?? "";
  const query = new URLSearchParams({ q });
  if (status) query.set("status", status);

  const [result, compliance] = await Promise.all([
    safe(legalFetch<LegalActsResponse>("legal-acts", query, locale)),
    safe(legalFetch<CompliancePage>("compliance", new URLSearchParams(), locale)),
  ]);
  if (!result) return <Unavailable />;
  // API отдаёт акты и материалы комплаенс-службы одним списком без признака вида: вторые убираем по их id.
  const internal = new Set(compliance?.documents.map((document) => document.id));
  const acts = result.items.filter((act) => !internal.has(act.id));

  return (
    <>
      <PageHeader crumbs={[{ label: t("title") }]} title={t("title")} lead={t("lead")} />
      <PageBody
        aside={
          <>
            <section aria-labelledby="legal-statuses">
              <h2 id="legal-statuses" className="mb-3 text-base">{t("legend.title")}</h2>
              <dl className="card divide-y px-5 text-[0.9375rem]">
                {LEGAL_STATUSES.map((value) => {
                  const Icon = STATUS_ICONS[value];
                  return (
                    <div key={value} className="py-3">
                      <dt className="flex items-center gap-1.5 font-medium"><Icon className="size-4" aria-hidden />{t(`status.${value}`)}</dt>
                      <dd className="mt-0.5 text-sm text-muted-foreground">{t(`legend.${value}`)}</dd>
                    </div>
                  );
                })}
              </dl>
            </section>
            <Notice title={t("official.title")}>
              <p>{t("official.text")}</p>
              <p className="mt-2"><ExternalLink href="https://adilet.zan.kz" className="text-primary underline underline-offset-[3px]">{t("official.link")}</ExternalLink></p>
            </Notice>
            <SeeAlso
              title={t("more.title")}
              items={[
                { href: "/services/state", label: t("more.state") },
                { href: "/services/paid", label: t("more.paid") },
                { href: "/compliance", label: t("more.compliance"), text: t("more.complianceText") },
              ]}
            />
          </>
        }
      >
        <form action={`/${locale}/legal`} method="get" role="search" aria-label={t("filter.label")} className="grid gap-4 card p-5 sm:grid-cols-[1fr_13rem_auto] sm:items-end">
          <Field name="q" type="search" label={t("filter.q")} defaultValue={q} maxLength={200} />
          <SelectField name="status" label={t("filter.status")} defaultValue={status} options={[{ value: "", label: t("filter.all") }, ...LEGAL_STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))]} />
          <div className="flex gap-2">
            <Button type="submit" className="h-11 px-6">{t("filter.submit")}</Button>
            {(q || status) && <Button asChild variant="outline" className="h-11"><Link href="/legal">{t("filter.reset")}</Link></Button>}
          </div>
        </form>

        <section aria-labelledby="legal-list" aria-live="polite" className="space-y-4">
          <h2 id="legal-list" className="text-base font-semibold">{t("count", { count: acts.length })}</h2>
          {acts.length === 0 ? (
            <EmptyState resetHref="/legal" as="h2" />
          ) : (
            <RecordList>{acts.map((act) => <ActRow key={act.id} act={act} locale={locale} />)}</RecordList>
          )}
          <p className="max-w-3xl text-sm text-muted-foreground">{t("checkedNote")}</p>
        </section>
      </PageBody>
    </>
  );
}
