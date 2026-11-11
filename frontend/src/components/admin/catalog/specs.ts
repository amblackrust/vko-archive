import type { FieldSpec } from "./fields-form";

/** Описание полей форм каталога; имена совпадают с входными схемами бэкенда (schemas/admin_catalog.py). */
export const FUND_TYPES = ["organization", "personal", "party", "newspaper"];

export const CATALOG_KINDS = ["fund", "inventory", "case", "document"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export const CATALOG_SPECS: Record<CatalogKind, FieldSpec[]> = {
  fund: [
    { name: "number", type: "text", required: true, maxLength: 64 },
    { name: "title", type: "i18n", required: true },
    { name: "type", type: "select", options: FUND_TYPES, required: true },
    { name: "dates_from", type: "number" },
    { name: "dates_to", type: "number" },
    { name: "branch_id", type: "branch" },
    { name: "annotation", type: "i18nArea" },
    { name: "is_demo", type: "bool" },
  ],
  inventory: [
    { name: "number", type: "text", required: true, maxLength: 64 },
    { name: "title", type: "i18n" },
    { name: "dates_text", type: "text", maxLength: 255 },
    { name: "dates_from", type: "number" },
    { name: "dates_to", type: "number" },
    { name: "is_demo", type: "bool" },
  ],
  case: [
    { name: "number", type: "text", required: true, maxLength: 64 },
    { name: "title", type: "i18n" },
    { name: "dates_text", type: "text", maxLength: 255 },
    { name: "dates_from", type: "number" },
    { name: "dates_to", type: "number" },
    { name: "sheets_count", type: "number" },
    { name: "is_demo", type: "bool" },
  ],
  document: [
    { name: "archive_code", type: "text", required: true, maxLength: 255 },
    { name: "title", type: "i18n", required: true },
    { name: "date_text", type: "text", maxLength: 255 },
    { name: "date_from", type: "date" },
    { name: "date_to", type: "date" },
    { name: "period", type: "text", maxLength: 64 },
    { name: "doc_type", type: "text", maxLength: 64 },
    { name: "language", type: "text", maxLength: 32 },
    { name: "authors", type: "i18n" },
    { name: "places", type: "lines" },
    { name: "summary", type: "i18nArea" },
    { name: "historical_note", type: "i18nArea" },
    { name: "sheets_count", type: "number" },
    { name: "storage_location", type: "text", maxLength: 255 },
    { name: "description_status", type: "select", options: ["public", "do_not_publish", "needs_review"], required: true },
    { name: "file_access", type: "select", options: ["open", "restricted", "closed", "needs_review"], required: true },
    { name: "access_conditions", type: "i18nArea" },
    { name: "is_demo", type: "bool" },
  ],
};

export const BRANCH_TYPES = ["head", "district", "city", "personnel"];
export const BRANCH_SPEC: FieldSpec[] = [
  { name: "slug", type: "slug", required: true },
  { name: "name", type: "i18n", required: true },
  { name: "short_name", type: "i18n" },
  { name: "type", type: "select", options: BRANCH_TYPES, required: true },
  { name: "address", type: "i18n" },
  { name: "phone", type: "text", maxLength: 255 },
  { name: "email", type: "text", maxLength: 320 },
  { name: "director", type: "i18n" },
  { name: "hours", type: "i18n" },
  { name: "description", type: "i18nArea" },
  { name: "funds_summary", type: "i18nArea" },
  { name: "coords_verified", type: "bool" },
  { name: "show_on_map", type: "bool" },
  { name: "position", type: "number" },
];

export const EXHIBITION_SPEC: FieldSpec[] = [
  { name: "slug", type: "slug", required: true },
  { name: "title", type: "i18n", required: true },
  { name: "theme", type: "text", maxLength: 128 },
  { name: "period", type: "text", maxLength: 64 },
  { name: "intro", type: "i18nArea" },
  { name: "is_demo", type: "bool" },
];

export const EXHIBIT_SPEC: FieldSpec[] = [
  { name: "title", type: "i18n", required: true },
  { name: "caption", type: "i18nArea" },
  { name: "source", type: "i18n" },
  { name: "media_url", type: "text", maxLength: 1024 },
  { name: "archive_code", type: "text", maxLength: 255 },
  { name: "is_demo", type: "bool" },
];
