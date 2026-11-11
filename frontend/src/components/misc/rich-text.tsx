import { cn } from "@/lib/utils";

/**
 * Текст из CMS (страницы, новости): HTML уже очищен на сервере (backend/app/services/sanitize.py),
 * весь HTML из API в этом разделе выводится только через этот компонент.
 */
export function RichText({ html, lang, className }: { html: string; lang?: string; className?: string }) {
  return (
    <div
      lang={lang}
      className={cn(
        "reading max-w-[70ch] break-words [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-[3px] [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:font-sans [&_h2]:text-2xl [&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:font-sans [&_h3]:text-lg [&_li]:mt-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
