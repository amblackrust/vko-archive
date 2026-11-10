/**
 * Список namespace словарей. Файл messages/<locale>/<namespace>.json
 * должен существовать для каждой локали. Чтобы добавить раздел:
 * 1) создать messages/{kk,ru,en}/<name>.json, 2) добавить <name> сюда.
 */
export const namespaces = ["common", "layout", "states", "catalog", "document"] as const;
