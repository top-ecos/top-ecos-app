import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Send, Loader2 } from "lucide-react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { toast } from "@/shared/components/ui/sonner";

interface ChatInputProps {
  inputMessage: string;
  isLoading: boolean;
  isPaused: boolean;
  isTimeUp: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  placeholderText?: string;
}

/**
 * Whisper fallback endpoint — built from the same env var used by useChat.ts
 * Falls back to empty string (= no Whisper fallback) if env var is missing.
 */
const WHISPER_ENDPOINT = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-to-text`
  : "";

const ChatInput = ({
  inputMessage,
  isLoading,
  isPaused,
  isTimeUp,
  onInputChange,
  onSend,
  placeholderText,
}: ChatInputProps) => {
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const baseTextRef = useRef<string>("");
  const finalDictationRef = useRef<string>("");
  const unmountedRef = useRef(false);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  // ── Stable onResult callback ──
  const handleSpeechResult = useCallback(
    (text: string, isFinal: boolean) => {
      if (unmountedRef.current) return;

      // "…" is the Whisper "processing" signal
      if (text === "…" && !isFinal) {
        setIsTranscribing(true);
        return;
      }

      setIsTranscribing(false);
      const base = baseTextRef.current || "";
      const prevFinal = finalDictationRef.current || "";

      if (isFinal) {
        finalDictationRef.current = `${prevFinal}${prevFinal ? " " : ""}${text}`.trim();
        const merged = `${base} ${finalDictationRef.current}`.trim();
        onInputChange(merged);
      } else {
        const preview = `${base} ${prevFinal} ${text}`.trim();
        onInputChange(preview);
      }
    },
    [onInputChange],
  );

  const isDisabled = isLoading || isPaused || isTimeUp;
  const buttonDisabled = isDisabled || !inputMessage.trim() || isSending;

  const { isSupported, isListening, error, engine, start, stop } = useSpeechRecognition({
    lang: "fr-FR",
    interimResults: true,
    continuous: true,
    maxDurationMs: 60_000,
    silenceMs: 2_000,
    onResult: handleSpeechResult,
    whisperEndpoint: WHISPER_ENDPOINT || undefined,
  });

  // ── Stop listening if station becomes disabled ──
  useEffect(() => {
    if (isDisabled && isListening) stop();
  }, [isDisabled, isListening, stop]);

  // ── Error toasts ──
  useEffect(() => {
    if (!error) return;
    const messages: Record<string, string> = {
      "not-allowed": "Autorise le micro pour utiliser la dictée.",
      "service-not-allowed": "Le service micro est bloqué par le navigateur.",
      "no-speech": "Aucun son détecté. Réessaie.",
      "network": "Problème réseau détecté.",
      "start-failed": "Impossible de démarrer la dictée.",
      "no-whisper-endpoint": "Service de transcription non configuré.",
      "whisper-failed": "Erreur de transcription. Réessaie.",
      "unknown": "Erreur de dictée inconnue.",
    };
    toast.error(messages[error] || `Erreur de dictée : ${error}`);
  }, [error]);

  // ── Send — no more busy-wait ──
  const handleSend = useCallback(async () => {
    if (isSending || !inputMessage.trim() || isDisabled) return;

    setIsSending(true);
    try {
      if (isListening) {
        await stop();
        // Give React one tick to flush state updates from onend
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!unmountedRef.current) onSend();
    } finally {
      if (!unmountedRef.current) setIsSending(false);
    }
  }, [isSending, inputMessage, isDisabled, isListening, stop, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListening = () => {
    if (isDisabled) return;
    if (!isListening) {
      baseTextRef.current = inputMessage;
      finalDictationRef.current = "";
      start();
    } else {
      stop();
    }
  };

  const placeholder = isTimeUp
    ? "Temps écoulé"
    : isPaused
      ? "En pause — reprends pour continuer"
      : (placeholderText || "Procède à l'interrogatoire…");

  // ── Engine-aware mic label ──
  const micTitle = isListening
    ? engine === "whisper"
      ? "Arrêter l'enregistrement"
      : "Arrêter la dictée"
    : "Démarrer la dictée";

  return (
    <div className="px-3 pb-3 pt-2 bg-white">
      {/* FIX: added `relative` so the ping span positions correctly */}
      <div
        className={`relative flex items-end gap-2 rounded-2xl border px-3 py-2 transition-all duration-200 ${
          isDisabled
            ? "bg-gray-50 border-gray-200"
            : "bg-gray-50 border-gray-200 focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-sm"
        }`}
      >
        {/* Mic pulse ring when listening */}
        {isListening && (
          <span className="absolute inset-0 rounded-2xl pointer-events-none animate-ping border-2 border-red-300 opacity-30" />
        )}

        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className={`flex-1 resize-none bg-transparent border-0 outline-none ring-0 focus:ring-0 focus:outline-none min-h-[44px] max-h-[120px] text-gray-900 placeholder-gray-400 text-sm py-2.5 leading-relaxed ${
            isDisabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
          style={{ height: "auto", minHeight: "44px" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = Math.min(target.scrollHeight, 120) + "px";
          }}
        />

        <div className="flex items-center gap-1.5 pb-1 flex-shrink-0">
          {isSupported && (
            <button
              onClick={toggleListening}
              disabled={isDisabled || isTranscribing}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                isTranscribing
                  ? "bg-amber-500 text-white shadow-md shadow-amber-200 animate-pulse"
                  : isListening
                    ? "bg-red-500 text-white shadow-md shadow-red-200 scale-105"
                    : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-100 hover:text-gray-700"
              } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
              title={isTranscribing ? "Transcription en cours…" : micTitle}
              aria-label={isTranscribing ? "Transcription en cours…" : micTitle}
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={buttonDisabled}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 flex-none ${
              buttonDisabled
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-[#03BB26] hover:bg-green-600 text-white shadow-sm hover:shadow-md hover:shadow-green-200 active:scale-95"
            }`}
            aria-label="Envoyer"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isTimeUp && (
        <p className="mt-2 text-center text-xs text-red-400 font-medium">
          Temps écoulé · Évalue ta performance ou quitte la station
        </p>
      )}
    </div>
  );
};

export default ChatInput;
