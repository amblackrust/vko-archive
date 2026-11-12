"use client";

import clsx from "clsx";
import { Mic, Square, Volume2 } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useSpeech } from "@/hooks/use-speech";

/** Microphone for a text field: pressed = listening. Not rendered where the browser has no speech recognition. */
export function MicButton({ label, onText, className }: { label: string; onText: (text: string, final: boolean) => void; className?: string }) {
  const { canListen, listening, listen, stopListening } = useSpeech();
  if (!canListen) return null;
  return (
    <IconButton
      label={label}
      aria-pressed={listening}
      onClick={() => (listening ? stopListening() : listen(onText))}
      className={clsx(listening && "animate-pulse bg-action text-action-ink hover:bg-action hover:text-action-ink", className)}
    >
      <Mic size={18} aria-hidden />
    </IconButton>
  );
}

/** Reads `text` aloud; pressing it again stops. Not rendered where the browser has no speech synthesis. */
export function SpeakButton({ text, label, stopLabel }: { text: string; label: string; stopLabel: string }) {
  const { canSpeak, speaking, speak, stopSpeaking } = useSpeech();
  if (!canSpeak) return null;
  return (
    <IconButton label={speaking ? stopLabel : label} aria-pressed={speaking} onClick={() => (speaking ? stopSpeaking() : speak(text))} className="size-8">
      {speaking ? <Square size={14} aria-hidden /> : <Volume2 size={16} aria-hidden />}
    </IconButton>
  );
}
