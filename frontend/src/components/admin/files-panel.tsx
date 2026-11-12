"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Upload } from "lucide-react";
import { api, buildUrl, csrfHeaders, type Schema } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Media } from "@/components/ui/media";

const ACCESS = ["open", "restricted", "closed", "needs_review"] as const;

/** Files attached to a saved object. New files start as "needs review" until a staff member opens them. */
export function FilesPanel({ ownerType, ownerId }: { ownerType: string; ownerId: string }) {
  const t = useTranslations("admin.form");
  const d = useTranslations("dict");
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const key = ["admin-files", ownerType, ownerId];
  const { data } = useQuery({ queryKey: key, queryFn: () => api.get<Schema["UploadedFile"][]>("/api/admin/uploads", { query: { owner_type: ownerType, owner_id: ownerId }, scope: "admin" }) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const res = await fetch(buildUrl("/api/admin/uploads", { owner_type: ownerType, owner_id: ownerId, filename: file.name }), { method: "POST", credentials: "include", headers: { "Content-Type": file.type || "application/octet-stream", ...csrfHeaders("admin") }, body: file });
      if (!res.ok) throw new Error(String(res.status));
    },
    onSuccess: refresh,
  });
  const patch = useMutation({ mutationFn: ({ id, access }: { id: string; access: string }) => api.patch(`/api/admin/uploads/${id}`, { body: { access }, scope: "admin" }), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/api/admin/uploads/${id}`, { scope: "admin" }), onSuccess: refresh });
  return (
    <section className="mt-12 border-t border-frame pt-8">
      <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-2xl">{t("files")}</h2>
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={upload.isPending}><Upload size={16} aria-hidden /> {t("upload")}</Button>
        <input ref={input} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
      </div>
      <ul>
        {(data ?? []).map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-4 border-b border-frame py-3 first:border-t">
            {f.preview_url && <Media src={f.preview_url} className="h-14 w-20 rounded-lg object-cover" />}
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-medium">{f.original_name}</a>
            <span className="tnum text-sm text-ink-3">{Math.round(f.size / 1024)} KB</span>
            <select className="field !w-auto" value={f.access} onChange={(e) => patch.mutate({ id: f.id, access: e.target.value })} aria-label={d("access.open")}>{ACCESS.map((a) => <option key={a} value={a}>{d(`access.${a}`)}</option>)}</select>
            <button type="button" onClick={() => del.mutate(f.id)} aria-label={t("delete")} className="grid size-10 place-items-center rounded-full text-ink-3 hover:bg-mount-2 hover:text-bad"><Trash2 size={17} /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
