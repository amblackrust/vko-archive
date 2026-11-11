"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "../confirm-dialog";
import { DataTable, type Column } from "../data-table";
import { FormField } from "../form-field";
import { Notice } from "../notice";
import { useApiError } from "../use-api-error";
import { useLoad } from "../use-load";
import { settingsApi, type Synonym } from "./settings-api";

const split = (text: string) => text.split(",").map((term) => term.trim()).filter(Boolean);

/** Группы синонимов поиска (Усть-Каменогорск = Өскемен = Ust-Kamenogorsk): строка с терминами через запятую. */
export function SynonymsPanel() {
  const t = useTranslations("adminContent.synonyms");
  const tc = useTranslations("admin.common");
  const describe = useApiError();
  const list = useLoad(() => settingsApi.synonyms(), []);
  const [editing, setEditing] = useState<{ id: string | null; terms: string; note: string } | null>(null);
  const [removing, setRemoving] = useState<Synonym | null>(null);
  const [state, setState] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const terms = split(editing.terms);
    if (terms.length < 2) return setState({ kind: "error", text: t("minTerms") });
    setPending(true);
    try {
      const body = { terms, note: editing.note.trim() || null };
      if (editing.id) await settingsApi.updateSynonym(editing.id, body);
      else await settingsApi.createSynonym(body);
      setEditing(null);
      setState({ kind: "success", text: t("saved") });
      list.reload();
    } catch (caught) {
      setState({ kind: "error", text: describe(caught) });
    } finally {
      setPending(false);
    }
  }

  async function toggle(row: Synonym) {
    try {
      await settingsApi.updateSynonym(row.id, { is_active: !row.is_active });
      list.reload();
    } catch (caught) {
      setState({ kind: "error", text: describe(caught) });
    }
  }

  const columns: Column<Synonym>[] = [
    { key: "terms", header: t("terms"), cell: (row) => row.terms.join(" = ") },
    { key: "note", header: t("note"), cell: (row) => row.note ?? "—" },
    {
      key: "active",
      header: t("active"),
      cell: (row) => (
        <input type="checkbox" className="size-4" aria-label={t("toggle", { name: row.terms[0] })} checked={row.is_active} onChange={() => toggle(row)} />
      ),
    },
    {
      key: "actions",
      header: tc("actions"),
      className: "whitespace-nowrap",
      cell: (row) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label={t("edit", { name: row.terms[0] })} onClick={() => setEditing({ id: row.id, terms: row.terms.join(", "), note: row.note ?? "" })}>
            <Pencil />
          </Button>
          <Button size="icon" variant="ghost" aria-label={t("delete", { name: row.terms[0] })} onClick={() => setRemoving(row)}>
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
        <Button onClick={() => setEditing({ id: null, terms: "", note: "" })}>
          <Plus aria-hidden />
          {t("create")}
        </Button>
      </div>
      {state && <Notice kind={state.kind}>{state.text}</Notice>}
      {editing && (
        <form onSubmit={save} className="space-y-3 rounded-lg border bg-surface p-4">
          <FormField label={t("termsField")} htmlFor="syn-terms" hint={t("termsHint")}>
            <Input id="syn-terms" required value={editing.terms} onChange={(e) => setEditing({ ...editing, terms: e.target.value })} />
          </FormField>
          <FormField label={t("note")} htmlFor="syn-note">
            <Input id="syn-note" maxLength={255} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>{tc("cancel")}</Button>
          </div>
        </form>
      )}
      <DataTable caption={t("title")} columns={columns} rows={list.data} rowKey={(row) => row.id} loading={list.loading} error={list.error} onRetry={list.reload} emptyText={t("empty")} />
      {removing && (
        <ConfirmDialog
          open
          danger
          onOpenChange={(open) => !open && setRemoving(null)}
          title={t("deleteTitle")}
          description={t("deleteDescription", { name: removing.terms.join(" = ") })}
          confirmLabel={t("deleteConfirm")}
          onConfirm={async () => {
            try {
              await settingsApi.removeSynonym(removing.id);
              list.reload();
            } catch (caught) {
              setState({ kind: "error", text: describe(caught) });
            }
          }}
        />
      )}
    </div>
  );
}
