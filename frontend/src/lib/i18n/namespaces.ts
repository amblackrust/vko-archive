/**
 * Список namespace словарей. Файл messages/<locale>/<namespace>.json
 * должен существовать для каждой локали. Чтобы добавить раздел:
 * 1) создать messages/{kk,ru,en}/<name>.json, 2) добавить <name> сюда.
 */
export const namespaces = [
  "common",
  "layout",
  "states",
  "catalog",
  "document",
  "search",
  "ai",
  "aiDocument",
  "home",
  "map",
  "about",
  "help",
  "contacts",
  "services",
  "legal",
  "compliance",
  "admin",
  "adminCatalog",
  "adminImport",
  "memory",
  "timeline",
  "historyMap",
  "exhibitions",
  "news",
  "cabinet",
  "misc",
  "adminAi",
  "adminContent",
] as const;
