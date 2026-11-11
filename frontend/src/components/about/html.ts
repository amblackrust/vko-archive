/** Разбор HTML страниц из CMS (он уже очищен на сервере): только чтение текста и деление на блоки. */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ", "#x27": "'", "#39": "'" };

/** Текст без тегов; основные HTML-сущности раскрыты. */
export const plainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x27|#39|[a-z]+);/g, (match, name: string) => ENTITIES[name] ?? match)
    .replace(/\s+/g, " ")
    .trim();

/** Блоки верхнего уровня (абзацы, заголовки, списки). null — тело устроено иначе, его нужно вывести целиком. */
export function topBlocks(html: string): string[] | null {
  const blocks = html.match(/<(p|h2|h3|ul|ol|blockquote)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g) ?? [];
  return blocks.length > 0 && blocks.join("").length === html.replace(/>\s+</g, "><").trim().length ? blocks : null;
}
