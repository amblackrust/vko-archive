/**
 * Описание полей форм админки. Имена совпадают с входными схемами бэкенда
 * (schemas/admin_catalog.py, schemas/admin_cms.py); подписи — <ns>.fields.<name>.
 */
export type FieldSpec =
  | { name: string; type: "text" | "date" | "slug"; required?: boolean; maxLength?: number; lockedOnEdit?: boolean }
  | { name: string; type: "number"; required?: boolean; step?: string }
  | { name: string; type: "i18n" | "i18nArea" | "rich"; required?: boolean }
  | { name: string; type: "select"; options: string[]; required?: boolean }
  | { name: string; type: "bool" | "branch" | "lines" | "sources" | "media" | "related" | "legalAct" }
  /** Подзаголовок группы полей: <ns>.sections.<name>. */
  | { name: string; type: "section" };

export const CATALOG_KINDS = ["fund", "inventory", "case", "document"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

const slug = { name: "slug", type: "slug", required: true, maxLength: 100 } as const;
const demo = { name: "is_demo", type: "bool" } as const;
const section = (name: string) => ({ name, type: "section" }) as const;

export const SPECS: Record<string, FieldSpec[]> = {
  fund: [
    { name: "number", type: "text", required: true, maxLength: 64 },
    { name: "type", type: "select", options: ["organization", "personal", "party", "newspaper"], required: true },
    { name: "title", type: "i18n", required: true },
    { name: "dates_from", type: "number" },
    { name: "dates_to", type: "number" },
    { name: "branch_id", type: "branch" },
    { name: "annotation", type: "i18nArea" },
    demo,
  ],
  inventory: [
    { name: "number", type: "text", required: true, maxLength: 64 },
    { name: "dates_text", type: "text", maxLength: 255 },
    { name: "title", type: "i18n" },
    { name: "dates_from", type: "number" },
    { name: "dates_to", type: "number" },
    demo,
  ],
  case: [
    { name: "number", type: "text", required: true, maxLength: 64 },
    { name: "dates_text", type: "text", maxLength: 255 },
    { name: "title", type: "i18n" },
    { name: "dates_from", type: "number" },
    { name: "dates_to", type: "number" },
    { name: "sheets_count", type: "number" },
    demo,
  ],
  document: [
    { name: "archive_code", type: "text", required: true, maxLength: 255 },
    { name: "doc_type", type: "text", maxLength: 64 },
    { name: "title", type: "i18n", required: true },
    { name: "authors", type: "i18n" },
    section("dates"),
    { name: "date_text", type: "text", maxLength: 255 },
    { name: "period", type: "text", maxLength: 64 },
    { name: "date_from", type: "date" },
    { name: "date_to", type: "date" },
    section("description"),
    { name: "summary", type: "i18nArea" },
    { name: "historical_note", type: "i18nArea" },
    { name: "places", type: "lines" },
    { name: "language", type: "text", maxLength: 32 },
    { name: "sheets_count", type: "number" },
    section("access"),
    { name: "description_status", type: "select", options: ["public", "do_not_publish", "needs_review"], required: true },
    { name: "file_access", type: "select", options: ["open", "restricted", "closed", "needs_review"], required: true },
    { name: "access_conditions", type: "i18nArea" },
    { name: "storage_location", type: "text", maxLength: 255 },
    demo,
  ],
  branch: [
    { name: "slug", type: "slug", required: true },
    { name: "type", type: "select", options: ["head", "district", "city", "personnel"], required: true },
    { name: "name", type: "i18n", required: true },
    { name: "short_name", type: "i18n" },
    section("contacts"),
    { name: "address", type: "i18n" },
    { name: "phone", type: "text", maxLength: 255 },
    { name: "email", type: "text", maxLength: 320 },
    { name: "director", type: "i18n" },
    { name: "hours", type: "i18n" },
    section("about"),
    { name: "description", type: "i18nArea" },
    { name: "funds_summary", type: "i18nArea" },
    section("map"),
    { name: "show_on_map", type: "bool" },
    { name: "coords_verified", type: "bool" },
    { name: "position", type: "number" },
  ],
  exhibition: [
    { name: "slug", type: "slug", required: true },
    { name: "theme", type: "text", maxLength: 128 },
    { name: "title", type: "i18n", required: true },
    { name: "period", type: "text", maxLength: 64 },
    { name: "intro", type: "i18nArea" },
    demo,
  ],
  exhibit: [
    { name: "title", type: "i18n", required: true },
    { name: "caption", type: "i18nArea" },
    { name: "source", type: "i18n" },
    { name: "media_url", type: "text", maxLength: 1024 },
    { name: "archive_code", type: "text", maxLength: 255 },
    demo,
  ],
  news: [
    slug,
    { name: "category", type: "text", maxLength: 64 },
    { name: "title", type: "i18n", required: true },
    { name: "summary", type: "i18nArea" },
    { name: "body", type: "rich" },
    { name: "media", type: "media" },
    { name: "related", type: "related" },
    { name: "published_at", type: "date" },
    demo,
  ],
  page: [
    { name: "key", type: "slug", required: true, maxLength: 100, lockedOnEdit: true },
    { name: "section", type: "text", maxLength: 64 },
    { name: "title", type: "i18n", required: true },
    { name: "body", type: "rich" },
    { name: "position", type: "number" },
    section("seo"),
    { name: "seo_title", type: "i18n" },
    { name: "seo_description", type: "i18nArea" },
    { name: "seo_keywords", type: "i18n" },
  ],
  faq: [
    { name: "category", type: "text", required: true, maxLength: 64 },
    { name: "position", type: "number" },
    { name: "question", type: "i18n", required: true },
    { name: "answer", type: "i18nArea", required: true },
  ],
  legal_act: [
    slug,
    { name: "number", type: "text", maxLength: 64 },
    { name: "title", type: "i18n", required: true },
    { name: "date", type: "date" },
    { name: "status", type: "select", options: ["active", "amended", "expired"], required: true },
    { name: "issuer", type: "i18n" },
    { name: "adilet_url", type: "text", maxLength: 1024 },
    { name: "actualized_at", type: "date" },
  ],
  price_list_item: [
    { name: "name", type: "i18n", required: true },
    { name: "unit", type: "i18n" },
    { name: "price", type: "number", step: "0.01" },
    { name: "position", type: "number" },
    { name: "note", type: "i18nArea" },
    { name: "act_ref", type: "text", maxLength: 255 },
    { name: "legal_act_id", type: "legalAct" },
    { name: "actualized_at", type: "date" },
  ],
  memorial_date: [
    { name: "year", type: "number", required: true },
    { name: "month", type: "number", required: true },
    { name: "day", type: "number" },
    { name: "event_year", type: "number" },
    { name: "date_text", type: "text", maxLength: 64 },
    { name: "text", type: "i18nArea", required: true },
  ],
  collection: [
    slug,
    { name: "theme", type: "text", maxLength: 128 },
    { name: "title", type: "i18n", required: true },
    { name: "period", type: "text", maxLength: 64 },
    { name: "description", type: "i18nArea" },
    demo,
  ],
  person: [
    slug,
    { name: "years_text", type: "text", maxLength: 64 },
    { name: "name", type: "i18n", required: true },
    { name: "birth_year", type: "number" },
    { name: "death_year", type: "number" },
    { name: "bio", type: "i18nArea" },
    { name: "sources", type: "sources" },
    demo,
  ],
  historical_event: [
    slug,
    { name: "theme", type: "text", maxLength: 128 },
    { name: "title", type: "i18n", required: true },
    { name: "date_text", type: "text", maxLength: 64 },
    { name: "date_from", type: "date" },
    { name: "date_to", type: "date" },
    { name: "place", type: "i18n" },
    { name: "lat", type: "number", step: "0.000001" },
    { name: "lng", type: "number", step: "0.000001" },
    { name: "description", type: "i18nArea" },
    { name: "sources", type: "sources" },
    demo,
  ],
};

export type FileOwner = "document" | "exhibit" | "exhibition" | "branch" | "news" | "person" | "collection" | "legal_act";

interface KindInfo {
  /** Модуль прав: <module>.view / create / edit / delete. */
  module: "catalog" | "branches" | "content";
  /** Namespace подписей полей и заголовков создания. */
  ns: "adminCatalog" | "adminContent";
  /** Владелец загружаемых файлов и поле, в которое выбирается обложка, фото или документ. */
  files?: { owner: FileOwner; pickField?: string };
}

const content = (files?: KindInfo["files"]): KindInfo => ({ module: "content", ns: "adminContent", files });

/** Все виды объектов с согласованием: где искать подписи, какой модуль прав, есть ли файлы. */
export const KINDS: Record<string, KindInfo> = {
  fund: { module: "catalog", ns: "adminCatalog" },
  inventory: { module: "catalog", ns: "adminCatalog" },
  case: { module: "catalog", ns: "adminCatalog" },
  document: { module: "catalog", ns: "adminCatalog", files: { owner: "document" } },
  branch: { module: "branches", ns: "adminCatalog", files: { owner: "branch", pickField: "photo_file_id" } },
  exhibition: { module: "content", ns: "adminCatalog", files: { owner: "exhibition", pickField: "cover_file_id" } },
  exhibit: { module: "content", ns: "adminCatalog", files: { owner: "exhibit", pickField: "media_file_id" } },
  news: content({ owner: "news", pickField: "cover_file_id" }),
  page: content(),
  faq: content(),
  legal_act: content({ owner: "legal_act", pickField: "file_id" }),
  price_list_item: content(),
  memorial_date: content(),
  collection: content({ owner: "collection", pickField: "cover_file_id" }),
  person: content({ owner: "person", pickField: "photo_file_id" }),
  historical_event: content(),
};
