"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

const LANGS: Record<string, string> = { kk: "kk-KZ", ru: "ru-RU", en: "en-US" };

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

/** Markers like [S1] and markdown marks are not meant to be read aloud. */
const spoken = (text: string) =>
  text
    .replace(/\[S\d+\]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Browser speech recognition and read-aloud. The flags stay false where the API is missing (and on the server), so callers render no buttons. */
export function useSpeech() {
  const lang = LANGS[useLocale()] ?? "en-US";
  const [canListen, setCanListen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    setCanListen(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    setCanSpeak("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    return () => {
      recognition.current?.abort();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  /** `onText` gets the interim text while the visitor speaks and the final text once (final = true). */
  const listen = useCallback(
    (onText: (text: string, final: boolean) => void) => {
      const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
      const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!Ctor) return;
      const rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = true;
      rec.onresult = (e) => {
        const parts = Array.from(e.results);
        const text = parts.map((r) => r[0].transcript).join("").trim();
        if (text) onText(text, parts[parts.length - 1].isFinal);
      };
      // A refused microphone or a recognition error just ends the listening state.
      rec.onend = rec.onerror = () => setListening(false);
      recognition.current = rec;
      try {
        rec.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    },
    [lang],
  );
  const stopListening = useCallback(() => recognition.current?.stop(), []);

  const speak = useCallback(
    (text: string) => {
      const clean = spoken(text);
      if (!clean) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang;
      u.onend = u.onerror = () => {
        if (utterance.current === u) setSpeaking(false);
      };
      utterance.current = u;
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [lang],
  );
  const stopSpeaking = useCallback(() => {
    utterance.current = null;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { canListen, canSpeak, listening, speaking, listen, stopListening, speak, stopSpeaking };
}
