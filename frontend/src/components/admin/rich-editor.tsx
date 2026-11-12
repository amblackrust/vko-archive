"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Heading2, Italic, Link as LinkIcon, List, ListOrdered, Quote } from "lucide-react";
import clsx from "clsx";

/** Minimal rich text for CMS bodies; the server sanitizes the HTML again. */
export function RichEditor({ value, onChange, label }: { value: string; onChange: (html: string) => void; label: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } })],
    content: value,
    editorProps: { attributes: { class: "prose min-h-48 max-w-none rounded-b-2xl px-4 py-3 outline-none", "aria-label": label } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });
  if (!editor) return <div className="h-48 animate-pulse rounded-2xl bg-mount-2" />;
  const btn = (active: boolean) => clsx("grid size-9 place-items-center rounded-lg transition-colors hover:bg-mount-2", active && "bg-action-soft text-action");
  return (
    <div className="rounded-2xl border border-frame-strong bg-paper focus-within:border-action">
      <div className="flex flex-wrap gap-0.5 border-b border-frame p-1.5" role="toolbar">
        <button type="button" aria-label="B" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></button>
        <button type="button" aria-label="I" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
        <button type="button" aria-label="H2" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></button>
        <button type="button" aria-label="UL" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></button>
        <button type="button" aria-label="OL" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></button>
        <button type="button" aria-label="Quote" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16} /></button>
        <button type="button" aria-label="Link" className={btn(editor.isActive("link"))} onClick={() => { const url = window.prompt("URL", editor.getAttributes("link").href ?? "https://"); if (url === null) return; if (!url) editor.chain().focus().unsetLink().run(); else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); }}><LinkIcon size={16} /></button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
