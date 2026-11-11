import { adminRequest } from "./admin";

/** Клиент админ-API каталога, филиалов, выставок и загрузок (B14). Пути хранилища на фронт не попадают. */

export type I18nValue = Record<string, string>;
export type FieldValue = string | number | boolean | null | I18nValue | I18nValue[];
export type Values = Record<string, FieldValue>;

export interface ContentObject {
  id: string;
  kind: string;
  version: number;
  workflow_status: string;
  translation_status: Record<string, string>;
  created_at: string;
  updated_at: string;
  available_actions: string[];
  values: Values;
  path: { kind: string; id: string; label: string }[];
  counts: Record<string, number>;
}

export interface ListItem {
  id: string;
  kind: string;
  number: string | null;
  title: I18nValue;
  workflow_status: string;
  version: number;
  updated_at: string;
  parent_id: string | null;
  children: number | null;
  extra: Record<string, unknown>;
}

export interface ListPage {
  items: ListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface HistoryEntry {
  id: number;
  ts: string;
  from_status: string | null;
  to_status: string;
  comment: string | null;
  version: number;
  changes: { field: string; old: unknown; new: unknown }[];
}

export interface UploadedFile {
  id: string;
  owner_type: string | null;
  owner_id: string | null;
  position: number;
  original_name: string | null;
  mime: string;
  size: number;
  pages: number | null;
  access: string;
  caption: I18nValue;
  url: string;
  preview_url: string | null;
}

export const FILE_ACCESS = ["needs_review", "open", "restricted", "closed"] as const;

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  return search.toString();
}

/** kind: fund | inventory | case | document | branch | exhibition | exhibit — путь REST у каждого свой. */
const CONTENT_KINDS = ["news", "page", "faq", "legal_act", "price_list_item", "memorial_date"];
const MEMORY_KINDS = ["collection", "person", "historical_event"];

function base(kind: string) {
  if (CONTENT_KINDS.includes(kind)) return `/content/${kind}`;
  if (MEMORY_KINDS.includes(kind)) return `/memory/${kind}`;
  if (kind === "branch") return "/branches";
  if (kind === "exhibition") return "/exhibitions";
  if (kind === "exhibit") return "/exhibits";
  return `/catalog/${kind}`;
}

export const contentApi = {
  list: (kind: string, params: { q?: string; parent_id?: string; page: number; page_size: number }) =>
    adminRequest<ListPage>(`${base(kind)}?${query(params)}`),
  get: (kind: string, id: string) => adminRequest<ContentObject>(`${base(kind)}/${id}`),
  create: (kind: string, values: Values) => adminRequest<ContentObject>(base(kind), { method: "POST", body: values }),
  update: (kind: string, id: string, version: number, values: Values) =>
    adminRequest<ContentObject>(`${base(kind)}/${id}`, { method: "PATCH", body: { ...values, version } }),
  remove: (kind: string, id: string) => adminRequest<void>(`${base(kind)}/${id}`, { method: "DELETE" }),
  transition: (kind: string, id: string, action: string, version: number, comment?: string) =>
    adminRequest<{ workflow_status: string; version: number; available_actions: string[] }>(
      `/workflow/${kind}/${id}/transitions`,
      { method: "POST", body: { action, version, comment: comment || null } },
    ),
  history: (kind: string, id: string) => adminRequest<HistoryEntry[]>(`/workflow/${kind}/${id}/history`),
  branchOptions: () => adminRequest<{ id: string; name: I18nValue }[]>("/catalog/branch-options"),
  exhibits: (exhibitionId: string) => adminRequest<ContentObject[]>(`/exhibitions/${exhibitionId}/exhibits`),
  reorderExhibits: (exhibitionId: string, ids: string[]) =>
    adminRequest<ContentObject[]>(`/exhibitions/${exhibitionId}/exhibits/order`, { method: "PUT", body: { ids } }),
};

export const filesApi = {
  list: (ownerType: string, ownerId: string) =>
    adminRequest<UploadedFile[]>(`/uploads?${query({ owner_type: ownerType, owner_id: ownerId })}`),
  upload: (ownerType: string, ownerId: string, file: File) =>
    adminRequest<UploadedFile>(`/uploads?${query({ owner_type: ownerType, owner_id: ownerId, filename: file.name })}`, {
      method: "POST",
      rawBody: file,
    }),
  update: (id: string, body: { access?: string; caption?: I18nValue }) =>
    adminRequest<UploadedFile>(`/uploads/${id}`, { method: "PATCH", body }),
  remove: (id: string) => adminRequest<void>(`/uploads/${id}`, { method: "DELETE" }),
};
