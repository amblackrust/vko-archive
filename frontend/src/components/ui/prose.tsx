import clsx from "clsx";

/** Renders server-sanitized CMS HTML (clean_html on the backend). */
export function Prose({ html, className }: { html: string; className?: string }) {
  return <div className={clsx("prose", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
