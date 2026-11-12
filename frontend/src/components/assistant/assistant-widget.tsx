"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, History, Plus, Square, Trash2, X } from "lucide-react";
import { Popover } from "radix-ui";
import clsx from "clsx";
import { useAiStream } from "@/lib/ai-stream";
import { SourceChips } from "./source-chips";
import { IconButton } from "@/components/ui/icon-button";
import { SPRING } from "@/lib/motion";
import type { Schema } from "@/lib/api/client";

type Turn = { role: "user" | "assistant"; text: string; result?: Schema["AiAnswer"] };
type Chat = { id: string; title: string; updated: number; turns: Turn[] };
const PANEL = "26rem";
const STORE = "vko-assistant-chats";
const MAX_CHATS = 30;
const MAX_TURNS = 60;

const newChat = (): Chat => ({ id: crypto.randomUUID(), title: "", updated: Date.now(), turns: [] });

/** Chats live in this browser only (localStorage): they survive reloads and are switched from the history menu. */
function loadChats(): { chats: Chat[]; active: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as { chats?: Chat[]; active?: string } | null;
    const chats = (raw?.chats ?? []).filter((c) => c && typeof c.id === "string" && Array.isArray(c.turns));
    if (chats.length) return { chats, active: chats.some((c) => c.id === raw?.active) ? (raw?.active as string) : chats[0].id };
  } catch {
    /* unreadable storage: start clean */
  }
  const fresh = newChat();
  return { chats: [fresh], active: fresh.id };
}

/** Chat docked to the right edge, like a console assistant. On wide screens the page makes room for it. */
export function AssistantWidget() {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const { state, run, stop, reset } = useAiStream();
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const busy = state.status === "loading" || state.status === "streaming";

  useEffect(() => {
    const saved = loadChats();
    setChats(saved.chats);
    setActiveId(saved.active);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    try {
      // Empty chats other than the open one are not worth keeping.
      const keep = chats.filter((c) => c.id === activeId || c.turns.length).slice(0, MAX_CHATS);
      localStorage.setItem(STORE, JSON.stringify({ chats: keep, active: activeId }));
    } catch {
      /* storage full or blocked: the chat still works for this visit */
    }
  }, [chats, activeId]);

  const turns = useMemo(() => chats.find((c) => c.id === activeId)?.turns ?? [], [chats, activeId]);
  const setTurns = (fn: (t: Turn[]) => Turn[]) =>
    setChats((all) =>
      all.map((c) => {
        if (c.id !== activeId) return c;
        const next = fn(c.turns).slice(-MAX_TURNS);
        return { ...c, turns: next, updated: Date.now(), title: c.title || (next.find((x) => x.role === "user")?.text.slice(0, 48) ?? "") };
      }),
    );
  const openChat = (id: string) => {
    stop();
    reset();
    setActiveId(id);
    setMenu(false);
  };
  const startChat = () => {
    stop();
    reset();
    const current = chats.find((c) => c.id === activeId);
    if (current && !current.turns.length) return setMenu(false);
    const fresh = newChat();
    setChats((all) => [fresh, ...all]);
    setActiveId(fresh.id);
    setMenu(false);
  };
  const removeChat = (id: string) => {
    const rest = chats.filter((c) => c.id !== id);
    if (id !== activeId) return setChats(rest);
    stop();
    reset();
    const next = rest[0] ?? newChat();
    setChats(rest.length ? rest : [next]);
    setActiveId(next.id);
  };

  useEffect(() => {
    const on = () => setOpen(true);
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((v) => !v); } };
    window.addEventListener("open-assistant", on);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("open-assistant", on); window.removeEventListener("keydown", key); };
  }, []);

  // Make room for the panel on wide screens; restore when it closes.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1100px)").matches;
    document.documentElement.style.setProperty("--chat-w", open && wide ? PANEL : "0px");
    if (open) setTimeout(() => field.current?.focus(), 250);
    return () => document.documentElement.style.setProperty("--chat-w", "0px");
  }, [open]);

  useEffect(() => {
    if (state.status === "done" && state.text) {
      setTurns((h) => [...h, { role: "assistant", text: state.text, result: state.result ?? undefined }]);
      reset();
    }
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, state.text]);

  // What the visitor is looking at, so the assistant can talk about this very page.
  const pageContext = () => ({
    path: window.location.pathname,
    title: document.title.slice(0, 200),
    text: (document.getElementById("main")?.innerText ?? "").replace(/\s+/g, " ").slice(0, 2500),
  });

  const ask = (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history = turns.slice(-6).map((x) => ({ role: x.role, text: x.text.slice(0, 1500) }));
    setTurns((h) => [...h, { role: "user", text: question }]);
    setQ("");
    void run("/api/ai/answer/stream", { q: question, lang: locale, history, page: pageContext() });
  };

  const cite = (ref: string) => {
    setFlash(ref);
    document.getElementById(`src-${ref}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => setFlash(null), 1400);
  };

  // [S1] markers become small buttons that point at the source chip.
  const body = (text: string) =>
    text.split(/(\[S\d+\])/g).map((part, i) => {
      const m = /^\[S(\d+)\]$/.exec(part);
      return m ? (
        <button key={i} type="button" onClick={() => cite(`S${m[1]}`)} className="mx-0.5 inline-grid size-[1.15rem] -translate-y-px place-items-center rounded-full bg-action-soft align-baseline text-[0.68rem] font-bold text-action transition-colors hover:bg-action hover:text-action-ink">{m[1]}</button>
      ) : <Fragment key={i}>{part}</Fragment>;
    });

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="complementary"
          aria-label={t("title")}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={SPRING}
          className="fixed inset-y-0 right-0 z-50 flex w-[min(26rem,100vw)] flex-col border-l border-frame bg-paper shadow-lift-high"
        >
          <header className="flex h-[3.75rem] shrink-0 items-center justify-between gap-2 border-b border-frame px-4">
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">{t("title")}</h2>
            <div className="flex items-center">
              <IconButton label={t("newChat")} onClick={startChat}><Plus size={18} /></IconButton>
              <Popover.Root open={menu} onOpenChange={setMenu}>
                <Popover.Trigger asChild><IconButton label={t("chats")}><History size={17} /></IconButton></Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content align="end" sideOffset={6} collisionPadding={12} className="pop z-[60] max-h-[26rem] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-frame bg-paper p-1.5 shadow-lift-high">
                    {chats.filter((c) => c.turns.length).length === 0 && <p className="px-3 py-2.5 text-ink-3">{t("noChats")}</p>}
                    {[...chats].filter((c) => c.turns.length).sort((a, b) => b.updated - a.updated).map((c) => (
                      <div key={c.id} className={clsx("group flex items-center gap-1 rounded-xl pr-1 transition-colors hover:bg-mount-2", c.id === activeId && "bg-action-soft")}>
                        <button type="button" onClick={() => openChat(c.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
                          <span className={clsx("block truncate font-medium", c.id === activeId && "text-action")}>{c.title || t("untitled")}</span>
                          <span className="block text-xs text-ink-3">{new Date(c.updated).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </button>
                        <button type="button" aria-label={t("deleteChat")} onClick={() => removeChat(c.id)} className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 opacity-0 transition-opacity hover:text-bad focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"><Trash2 size={15} aria-hidden /></button>
                      </div>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              <IconButton label="×" onClick={() => setOpen(false)}><X size={18} /></IconButton>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
            {turns.length === 0 && !busy && (
              <div className="pt-4">
                <p className="font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">{t("hello")}</p>
                <ul className="mt-6 flex flex-col items-start gap-2">
                  {(t.raw("suggest") as string[]).map((s) => (
                    <li key={s}><button type="button" onClick={() => ask(s)} className="rounded-2xl border border-frame-strong px-4 py-2.5 text-left text-[0.9375rem] font-medium transition-[border-color,background-color,transform] duration-200 ease-(--ease-spring) hover:border-action hover:bg-action-soft active:scale-[0.98]">{s}</button></li>
                  ))}
                </ul>
              </div>
            )}
            {turns.map((x, i) =>
              x.role === "user" ? (
                <div key={i} className="ml-auto w-fit max-w-[86%] rounded-2xl rounded-br-md bg-action px-4 py-2.5 text-action-ink">{x.text}</div>
              ) : (
                <div key={i} className="min-w-0">
                  <div>
                    <p className="whitespace-pre-line leading-relaxed">{body(x.text)}</p>
                    <SourceChips sources={x.result?.sources ?? []} active={flash} />
                    {x.result?.links?.length ? (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {x.result.links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-full bg-mount-2 px-3 text-[0.8125rem] font-semibold no-underline hover:bg-action hover:text-action-ink">{l.id === "egov" ? "eGov.kz" : "e-Otinish"}</a></li>)}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div>
                <p className="min-w-0 whitespace-pre-line leading-relaxed">
                  {state.text ? body(state.text) : <span className="inline-flex gap-1 pt-2" aria-label={t("title")}>{[0, 1, 2].map((d) => <motion.span key={d} className="size-1.5 rounded-full bg-ink-3" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.1, delay: d * 0.15 }} />)}</span>}
                  {state.text && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-action align-text-bottom" />}
                </p>
              </div>
            )}
            {state.status === "error" && <p className="text-sm text-ink-3">{state.error === "limit" ? t("limit") : t("unavailable")}</p>}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="shrink-0 border-t border-frame p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-frame-strong bg-paper p-1.5 transition-colors focus-within:border-action">
              <label htmlFor="assistant-q" className="sr-only">{t("placeholder")}</label>
              <textarea
                id="assistant-q"
                ref={field}
                rows={1}
                value={q}
                maxLength={500}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
                placeholder={t("placeholder")}
                className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 outline-none placeholder:text-ink-3"
              />
              {busy ? (
                <button type="button" onClick={stop} aria-label={t("stop")} className="grid size-10 shrink-0 place-items-center rounded-xl bg-mount-2"><Square size={14} aria-hidden /></button>
              ) : (
                <button type="submit" aria-label={t("send")} disabled={!q.trim()} className={clsx("grid size-10 shrink-0 place-items-center rounded-xl bg-action text-action-ink transition-[opacity,transform] active:scale-90", !q.trim() && "opacity-40")}><ArrowUp size={18} aria-hidden /></button>
              )}
            </div>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
