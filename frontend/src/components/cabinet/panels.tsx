"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DemoTag } from "@/components/ui/demo-tag";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { RecordList, RecordRow } from "@/components/ui/record-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { cabinetFetch, type FavoriteItem, type SearchEntry, type Selection, type Subscriptions, type Topic } from "./api";
import { ConfirmDialog, useCabinetList } from "./form";

const control = "h-11 rounded-md border border-border-strong bg-surface px-3 text-base hover:border-foreground";

/** Раздел кабинета: заголовок, пояснение, ошибка последнего действия и содержимое. */
function PanelShell({ id, error, loading, children }: { id: string; error: string | null; loading: boolean; children: React.ReactNode }) {
  const t = useTranslations("cabinet");
  return (
    <section aria-labelledby={`cabinet-${id}`} className="space-y-5">
      <div className="max-w-3xl space-y-1">
        <h2 id={`cabinet-${id}`} className="text-2xl">{t(`sections.${id}`)}</h2>
        <p className="text-muted-foreground">{t(`${id}.lead`)}</p>
      </div>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm">{t(`errors.${error}`)}</p>}
      {loading ? <Skeleton className="h-32 w-full" /> : children}
    </section>
  );
}

/** Пустой раздел: что здесь появится и куда пойти, чтобы оно появилось. */
function EmptyHint({ title, text, links }: { title: string; text: string; links?: { href: string; label: string }[] }) {
  return (
    <div className="card max-w-2xl p-5 sm:p-6">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-muted-foreground">{text}</p>
      {links && (
        <p className="mt-4 flex flex-wrap gap-2">
          {links.map((link) => <Button key={link.href} asChild variant="outline" size="sm"><Link href={link.href}>{link.label}</Link></Button>)}
        </p>
      )}
    </div>
  );
}

function RemoveButton({ label, onClick, icon: Icon = X }: { label: string; onClick: () => void; icon?: typeof X }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick}>
      <Icon />
    </Button>
  );
}

export function FavoritesPanel() {
  const t = useTranslations("cabinet");
  const locale = useLocale();
  const { data, error, mutate } = useCabinetList<FavoriteItem[]>(`/favorites?lang=${locale}`);
  return (
    <PanelShell id="favorites" error={error} loading={data === null && !error}>
      {data?.length === 0 && (
        <EmptyHint
          title={t("favorites.emptyTitle")}
          text={t("favorites.emptyText")}
          links={[{ href: "/catalog", label: t("favorites.toCatalog") }, { href: "/exhibitions", label: t("favorites.toExhibitions") }, { href: "/news", label: t("favorites.toNews") }]}
        />
      )}
      {data && data.length > 0 && (
        <RecordList>
          {data.map((item) => (
            <RecordRow
              key={`${item.type}-${item.id}`}
              title={item.title}
              href={item.href}
              meta={<>{t(`favorites.types.${item.type}`)}{item.is_demo && <DemoTag />}</>}
              aside={<RemoveButton label={t("favorites.remove", { title: item.title })} onClick={() => void mutate(() => cabinetFetch(`/favorites/${item.type}/${item.id}`, { method: "DELETE" }))} />}
            />
          ))}
        </RecordList>
      )}
    </PanelShell>
  );
}

/** Свои подборки: документы добавляются из избранного, поэтому в подборку попадают только опубликованные документы. */
export function SelectionsPanel() {
  const t = useTranslations("cabinet");
  const locale = useLocale();
  const { data, error, mutate } = useCabinetList<Selection[]>(`/selections?lang=${locale}`);
  const favorites = useCabinetList<FavoriteItem[]>(`/favorites?lang=${locale}`).data?.filter((item) => item.type === "document") ?? [];
  const [title, setTitle] = useState("");
  const [removing, setRemoving] = useState<Selection | null>(null);

  return (
    <PanelShell id="selections" error={error} loading={data === null && !error}>
      <form
        className="flex max-w-2xl flex-wrap items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await mutate(() => cabinetFetch("/selections", { method: "POST", body: { title } }))) setTitle("");
        }}
      >
        <label className="block min-w-56 flex-1 text-sm">
          <span className="mb-1.5 block font-medium">{t("selections.newTitle")}</span>
          <Input className="h-11 text-base" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} placeholder={t("selections.placeholder")} />
        </label>
        <Button type="submit" size="lg" className="h-11"><Plus aria-hidden />{t("selections.create")}</Button>
      </form>

      {data?.length === 0 && <EmptyHint title={t("selections.emptyTitle")} text={t("selections.emptyText")} />}
      <div className="space-y-8">
        {data?.map((selection) => {
          const free = favorites.filter((item) => !selection.documents.some((doc) => doc.id === item.id));
          return (
            <section key={selection.id} aria-label={selection.title} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-xl">{selection.title}</h3>
                  <p className="text-sm text-muted-foreground">{t("selections.count", { count: selection.documents.length })}</p>
                </div>
                <RemoveButton icon={Trash2} label={t("selections.delete", { title: selection.title })} onClick={() => setRemoving(selection)} />
              </div>
              {selection.documents.length > 0 && (
                <RecordList>
                  {selection.documents.map((doc) => (
                    <RecordRow
                      key={doc.id}
                      code={doc.archive_code ?? undefined}
                      title={doc.title}
                      href={doc.href}
                      aside={<RemoveButton label={t("selections.removeDocument", { title: doc.title })} onClick={() => void mutate(() => cabinetFetch(`/selections/${selection.id}/items/${doc.id}`, { method: "DELETE" }))} />}
                    />
                  ))}
                </RecordList>
              )}
              {free.length > 0 ? (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const id = String(new FormData(event.currentTarget).get("document"));
                    void mutate(() => cabinetFetch(`/selections/${selection.id}/items`, { method: "POST", body: { document_id: id } }));
                  }}
                >
                  <label className="block min-w-0 max-w-full text-sm sm:max-w-md">
                    <span className="mb-1.5 block font-medium">{t("selections.addPick")}</span>
                    <select name="document" className={`${control} w-full`}>
                      {free.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </label>
                  <Button type="submit" variant="outline" className="h-11">{t("selections.add")}</Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">{t(favorites.length ? "selections.allAdded" : "selections.needFavorites")}</p>
              )}
            </section>
          );
        })}
      </div>
      {removing && (
        <ConfirmDialog
          title={t("selections.deleteTitle")}
          text={t("selections.deleteText", { title: removing.title })}
          confirmLabel={t("selections.deleteConfirm")}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await cabinetFetch(`/selections/${removing.id}`, { method: "DELETE" });
            await mutate(async () => undefined);
          }}
        />
      )}
    </PanelShell>
  );
}

/** История поиска: запрос запоминается через форму и открывает обычный поиск; очистка — одной кнопкой с подтверждением. */
export function SearchesPanel() {
  const t = useTranslations("cabinet");
  const router = useRouter();
  const { data, error, mutate } = useCabinetList<SearchEntry[]>("/searches");
  const [clearing, setClearing] = useState(false);
  return (
    <PanelShell id="searches" error={error} loading={data === null && !error}>
      <form
        className="flex max-w-2xl flex-wrap items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
          if (query && (await mutate(() => cabinetFetch("/searches", { method: "POST", body: { query } })))) router.push(`/search?q=${encodeURIComponent(query)}`);
        }}
      >
        <label className="block min-w-56 flex-1 text-sm">
          <span className="mb-1.5 block font-medium">{t("searches.queryLabel")}</span>
          <Input name="q" type="search" className="h-11 text-base" required maxLength={200} placeholder={t("searches.placeholder")} />
        </label>
        <Button type="submit" size="lg" className="h-11">{t("searches.go")}</Button>
      </form>
      {data?.length === 0 && <EmptyHint title={t("searches.emptyTitle")} text={t("searches.emptyText")} />}
      {data && data.length > 0 && (
        <>
          <RecordList>
            {data.map((entry) => (
              <RecordRow
                key={entry.id}
                title={entry.query}
                href={entry.href}
                aside={<RemoveButton label={t("searches.removeOne", { query: entry.query })} onClick={() => void mutate(() => cabinetFetch(`/searches/${entry.id}`, { method: "DELETE" }))} />}
              />
            ))}
          </RecordList>
          <Button variant="outline" size="sm" onClick={() => setClearing(true)}>{t("searches.clear")}</Button>
        </>
      )}
      {clearing && (
        <ConfirmDialog
          title={t("searches.clearTitle")}
          text={t("searches.clearText")}
          confirmLabel={t("searches.clear")}
          onClose={() => setClearing(false)}
          onConfirm={async () => {
            await cabinetFetch("/searches", { method: "DELETE" });
            await mutate(async () => undefined);
          }}
        />
      )}
    </PanelShell>
  );
}

const TOPICS: Topic[] = ["news", "exhibitions"];

export function SubscriptionsPanel() {
  const t = useTranslations("cabinet");
  const { data, error, busy, mutate } = useCabinetList<Subscriptions>("/subscriptions");
  return (
    <PanelShell id="subscriptions" error={error} loading={data === null && !error}>
      <Notice className="max-w-2xl">{t("subscriptions.demo")}</Notice>
      <fieldset className="max-w-2xl" disabled={busy}>
        <legend className="sr-only">{t("sections.subscriptions")}</legend>
        <ul className="card divide-y px-5">
          {TOPICS.map((topic) => {
            const on = data?.topics.includes(topic) ?? false;
            return (
              <li key={topic}>
                <label className="flex cursor-pointer items-start gap-3 py-4">
                  <input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary" checked={on} onChange={() => void mutate(() => cabinetFetch(`/subscriptions/${topic}`, { method: on ? "DELETE" : "PUT" }))} />
                  <span>
                    <span className="block font-semibold">{t(`subscriptions.${topic}.title`)}</span>
                    <span className="block text-sm text-muted-foreground">{t(`subscriptions.${topic}.text`)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <p role="status" className="text-sm text-muted-foreground">{t("subscriptions.status", { count: data?.topics.length ?? 0 })}</p>
    </PanelShell>
  );
}
