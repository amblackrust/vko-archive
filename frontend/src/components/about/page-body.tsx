/** Тело страницы из CMS: санитизированный HTML (см. backend/app/models/content.py).
 *  Стили заголовков и списков — здесь, без typography-плагина. */
export function PageBody({ html, lang }: { html: string; lang: string }) {
  return (
    <div
      lang={lang}
      className="max-w-3xl space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
