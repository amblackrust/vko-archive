import { plainText } from "./html";

export interface Person {
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface Unit {
  id: string;
  name: string;
  people: Person[];
}

/**
 * Структура архива приходит страницей CMS: «<h2>Отдел</h2><ul><li>Должность: ФИО (телефон, e-mail)</li></ul>»
 * (так её собирает backend/seed из «Структура.docx»). Отдельного публичного API со структурой нет,
 * поэтому разбираем тело; если редактор изменил разметку и разобрать не удалось — пустой список,
 * и страница показывает текст как есть.
 */
export function parseStructure(html: string): Unit[] {
  const units: Unit[] = [];
  for (const [, heading, list] of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>\s*<ul[^>]*>([\s\S]*?)<\/ul>/g)) {
    const people: Person[] = [];
    for (const [, item] of list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      const match = plainText(item).match(/^([^:]+):\s*(.+?)(?:\s+\((.+)\))?$/);
      if (!match) return [];
      const contacts = (match[3] ?? "").split(",").map((part) => part.trim()).filter(Boolean);
      people.push({
        role: match[1].trim(),
        name: match[2].trim(),
        phone: contacts.find((part) => !part.includes("@")) ?? null,
        email: contacts.find((part) => part.includes("@")) ?? null,
      });
    }
    units.push({ id: `unit-${units.length + 1}`, name: plainText(heading), people });
  }
  return units;
}
