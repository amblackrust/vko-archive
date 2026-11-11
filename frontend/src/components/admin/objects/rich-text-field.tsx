"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FieldLang } from "../kit/lang-tabs";
import { MachineTranslateButton } from "../translations/translate-buttons";
import type { TranslationStatus } from "../translations/translations-api";
import { I18nLabel, translationSource, type MachineTranslateProps } from "./i18n-field";

interface RichTextFieldProps {
  label: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  translationStatus?: Record<string, string>;
  machine?: MachineTranslateProps;
}

const EDITOR_STYLE =
  "[&_.ProseMirror]:min-h-48 [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:outline-none " +
  "[&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-semibold " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline " +
  "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_p]:my-1.5";

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="icon" variant="ghost" className={cn("size-9", active && "bg-surface text-primary ring-1 ring-border-strong")} aria-label={label} aria-pressed={active} title={label} onClick={onClick}>
      {children}
    </Button>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const t = useTranslations("adminContent.rich");
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const chain = () => editor.chain().focus();

  function applyLink() {
    const href = url.trim();
    if (href === "") chain().unsetLink().run();
    else if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(href)) chain().extendMarkRange("link").setLink({ href }).run();
    else return;
    setLinkOpen(false);
    setUrl("");
  }

  return (
    <div className="space-y-1 border-b bg-surface-muted p-1">
      <div role="toolbar" aria-label={t("toolbar")} className="flex flex-wrap gap-0.5">
        <ToolButton label={t("bold")} active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}><Bold /></ToolButton>
        <ToolButton label={t("italic")} active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}><Italic /></ToolButton>
        <ToolButton label={t("h2")} active={editor.isActive("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolButton>
        <ToolButton label={t("h3")} active={editor.isActive("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 /></ToolButton>
        <ToolButton label={t("bullets")} active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}><List /></ToolButton>
        <ToolButton label={t("numbered")} active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}><ListOrdered /></ToolButton>
        <ToolButton label={t("quote")} active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()}><Quote /></ToolButton>
        <ToolButton label={t("link")} active={editor.isActive("link")} onClick={() => { setUrl(editor.getAttributes("link").href ?? ""); setLinkOpen((open) => !open); }}><Link2 /></ToolButton>
        <ToolButton label={t("undo")} onClick={() => chain().undo().run()}><Undo2 /></ToolButton>
        <ToolButton label={t("redo")} onClick={() => chain().redo().run()}><Redo2 /></ToolButton>
      </div>
      {linkOpen && (
        <div className="flex gap-2 p-1">
          <Input aria-label={t("linkUrl")} placeholder="https://" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } }} />
          <Button type="button" variant="outline" onClick={applyLink}>{t("apply")}</Button>
        </div>
      )}
    </div>
  );
}

/** Редактор одного языка. HTML на сервере всё равно очищается (services/sanitize.py): разрешены заголовки h2–h4, списки, ссылки. */
function LangEditor({ lang, html, onHtml }: { lang: string; html: string; onHtml: (html: string) => void }) {
  const t = useTranslations("adminContent.rich");
  const emitted = useRef(html);
  const onHtmlRef = useRef(onHtml);
  onHtmlRef.current = onHtml;
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false } })],
    content: html,
    editorProps: { attributes: { lang, "aria-label": t("area", { lang: lang.toUpperCase() }), role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: current }) => {
      emitted.current = current.isEmpty ? "" : current.getHTML();
      onHtmlRef.current(emitted.current);
    },
  });

  useEffect(() => {
    // Значение изменили снаружи (перезагрузка после сохранения или конфликта).
    if (editor && html !== emitted.current) {
      emitted.current = html;
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [html, editor]);

  if (!editor) return <div className="min-h-48 rounded-md border border-border-strong bg-surface" />;
  return (
    <div className="overflow-hidden rounded-md border border-border-strong bg-surface focus-within:border-foreground">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className={EDITOR_STYLE} />
    </div>
  );
}

/** Текст с оформлением и вкладками KZ / RU / EN (TipTap). */
export function RichTextField({ label, value, onChange, translationStatus, machine }: RichTextFieldProps) {
  const [lang, setLang] = useState<FieldLang>("ru");
  const latest = useRef(value);
  latest.current = value;
  const source = translationSource(value, lang);
  return (
    <div className="space-y-1.5">
      <I18nLabel label={label} lang={lang} onLang={setLang} value={value} status={translationStatus} />
      <LangEditor key={lang} lang={lang} html={value[lang] ?? ""} onHtml={(html) => onChange({ ...latest.current, [lang]: html })} />
      {machine && source && (
        <MachineTranslateButton {...machine} source={source} target={lang} targetStatus={translationStatus?.[lang] as TranslationStatus | undefined} />
      )}
    </div>
  );
}
